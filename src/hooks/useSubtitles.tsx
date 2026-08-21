import { useState, useRef, useCallback } from 'react';
import { searchSubtitles, downloadSubtitle } from '../services/unified/subtitles/OpenSubtitlesProvider';
import { getLanguageName } from '../utils/languageUtils';
import { saveSubtitleLanguagePreference, getSubtitleLanguagePreference } from '../utils/storage';
import { timeToSeconds } from '../utils/timeUtils';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import parseSrt from 'parse-srt';

// WebVTT uses dot-separated milliseconds (00:00:01.000) and an optional
// "WEBVTT" header + cue-identifier lines that parse-srt (built for the
// comma-separated SRT format) doesn't expect. Licensed-backend subtitle
// tracks and some local files come as .vtt, so we parse those ourselves
// and normalize timestamps to the same {start, end, startSeconds,
// endSeconds, text} shape parse-srt produces for .srt.
const parseVttContent = (content) => {
  const body = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const blocks = body.split('\n\n').map(b => b.trim()).filter(Boolean);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timingLineIndex = lines.findIndex(l => l.includes('-->'));
    if (timingLineIndex === -1) continue; // skip "WEBVTT" header / NOTE blocks / pure cue-id lines

    const timingLine = lines[timingLineIndex];
    const match = timingLine.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!match) continue;

    const toSrtTime = (t) => {
      const parts = t.trim().split(':');
      const normalized = parts.length === 2 ? `00:${t.trim()}` : t.trim();
      return normalized.replace('.', ',');
    };

    const start = toSrtTime(match[1]);
    const end = toSrtTime(match[2]);
    const text = lines.slice(timingLineIndex + 1).join('\n').trim();
    if (!text) continue;

    cues.push({ start, end, text });
  }

  return cues;
};

export const useSubtitles = (mediaId, mediaType, season, episode) => {
  const [availableLanguages, setAvailableLanguages] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [parsedSubtitles, setParsedSubtitles] = useState([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [localSubtitleName, setLocalSubtitleName] = useState(null);

  const lastSubtitleIndexRef = useRef(0);
  const preferredSubtitleLanguageLoadedRef = useRef(null);
  const initialSubtitlePreferenceAppliedRef = useRef(false);

  const loadSubtitlePreference = useCallback(async () => {
    const savedLangPref = await getSubtitleLanguagePreference();
    preferredSubtitleLanguageLoadedRef.current = savedLangPref;
    initialSubtitlePreferenceAppliedRef.current = false;
    return savedLangPref;
  }, []);

  const findSubtitles = useCallback(async () => {
    if (!mediaId || loadingSubtitles) return;
    setLoadingSubtitles(true);
    setAvailableLanguages({});

    const preferredLanguages = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh'];
    const languageQueryString = preferredLanguages.join(',');

    try {
      const results = await searchSubtitles(
        mediaId,
        languageQueryString,
        mediaType === 'tv' ? season : undefined,
        mediaType === 'tv' ? episode : undefined
      );

      const bestSubtitlesByLang = {};
      results.forEach(sub => {
        const attr = sub.attributes;
        if (!attr || !attr.language || !attr.files || attr.files.length === 0) {
          return;
        }

        if (attr.foreign_parts_only === true) {
          return;
        }

        const langCode = attr.language;
        const fileInfo = attr.files[0];

        const currentSubInfo = {
          language: langCode,
          languageName: getLanguageName(langCode),
          fileId: fileInfo.file_id,
          releaseName: attr.release,
          downloadCount: attr.download_count || 0,
          fps: attr.fps || -1,
          uploaderName: attr.uploader?.name,
          uploadDate: attr.upload_date,
          legacySubtitleId: attr.legacy_subtitle_id,
          moviehashMatch: attr.moviehash_match === true,
          fromTrusted: attr.from_trusted === true,
          hearingImpaired: attr.hearing_impaired === true,
        };

        const existingBest = bestSubtitlesByLang[langCode];

        if (!existingBest) {
          bestSubtitlesByLang[langCode] = currentSubInfo;
        } else {
          let newIsBetter = false;
          if (currentSubInfo.moviehashMatch && !existingBest.moviehashMatch) {
            newIsBetter = true;
          } else if (!currentSubInfo.moviehashMatch && existingBest.moviehashMatch) {
            newIsBetter = false;
          } else {
            if (currentSubInfo.fromTrusted && !existingBest.fromTrusted) {
              newIsBetter = true;
            } else if (!currentSubInfo.fromTrusted && existingBest.fromTrusted) {
              newIsBetter = false;
            } else {
              if (!currentSubInfo.hearingImpaired && existingBest.hearingImpaired) {
                newIsBetter = true;
              } else if (currentSubInfo.hearingImpaired && !existingBest.hearingImpaired) {
                newIsBetter = false;
              } else {
                if (currentSubInfo.downloadCount > existingBest.downloadCount) {
                  newIsBetter = true;
                }
              }
            }
          }

          if (newIsBetter) {
            bestSubtitlesByLang[langCode] = currentSubInfo;
          }
        }
      });

      setAvailableLanguages(bestSubtitlesByLang);
    } catch (err) {
      console.error("Error searching subtitles:", err);
    } finally {
      setLoadingSubtitles(false);
    }
  }, [mediaId, mediaType, season, episode, loadingSubtitles]);

  const selectSubtitle = useCallback(async (langCode) => {
    if (!langCode) {
      setParsedSubtitles([]);
      setSelectedLanguage(null);
      setCurrentSubtitleText('');
      setSubtitlesEnabled(false);
      saveSubtitleLanguagePreference(null);
      return;
    }

    if (langCode === selectedLanguage) {
      setSubtitlesEnabled(true);
      saveSubtitleLanguagePreference(langCode);
      return;
    }

    const bestSubtitleInfo = availableLanguages[langCode];
    if (!bestSubtitleInfo || !bestSubtitleInfo.fileId) {
      console.error(`Error: No valid subtitle fileId found for language: ${langCode}`);
      setLoadingSubtitles(false);
      return;
    }

    setLoadingSubtitles(true);
    setSelectedLanguage(langCode);
    setParsedSubtitles([]);
    setCurrentSubtitleText('');

    try {
      const srtContent = await downloadSubtitle(bestSubtitleInfo.fileId);

      if (srtContent) {
        const parsed = parseSrt(srtContent);

        const parsedWithSeconds = parsed.map(line => ({
          ...line,
          startSeconds: timeToSeconds(line.start),
          endSeconds: timeToSeconds(line.end),
        }));

        setParsedSubtitles(parsedWithSeconds);
        lastSubtitleIndexRef.current = 0;
        setSubtitlesEnabled(true);
        saveSubtitleLanguagePreference(langCode);
      } else {
        console.warn("Failed to download subtitle content.");
        setSelectedLanguage(null);
        setSubtitlesEnabled(false);
        saveSubtitleLanguagePreference(null);
      }
    } catch (err) {
      console.error("Error during subtitle download or parsing:", err);
      setSelectedLanguage(null);
      setSubtitlesEnabled(false);
      saveSubtitleLanguagePreference(null);
    } finally {
      setLoadingSubtitles(false);
    }
  }, [selectedLanguage, availableLanguages]);

  // Loads a subtitle track URL supplied directly (e.g. by the licensed
  // playback backend) rather than found via OpenSubtitles search.
  // Detects .srt vs .vtt by content/extension and feeds the same
  // parsedSubtitles pipeline the rest of the hook already drives.
  const loadTrackSubtitle = useCallback(async (url, label) => {
    if (!url) return { success: false, error: 'No subtitle URL provided.' };
    setLoadingSubtitles(true);
    setParsedSubtitles([]);
    setCurrentSubtitleText('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch subtitle (${response.status})`);
      const content = await response.text();

      const isVtt = /^\uFEFF?WEBVTT/i.test(content) || /\.vtt(\?|$)/i.test(url);
      const rawCues = isVtt ? parseVttContent(content) : parseSrt(content);

      const parsedWithSeconds = rawCues.map(line => ({
        ...line,
        startSeconds: timeToSeconds(line.start),
        endSeconds: timeToSeconds(line.end),
      }));

      if (parsedWithSeconds.length === 0) {
        setSubtitlesEnabled(false);
        return { success: false, error: 'Subtitle file contained no readable cues.' };
      }

      const code = `track:${label || 'default'}`;
      setParsedSubtitles(parsedWithSeconds);
      lastSubtitleIndexRef.current = 0;
      setSelectedLanguage(code);
      setSubtitlesEnabled(true);
      return { success: true, code };
    } catch (err) {
      console.error('Error loading track subtitle:', err);
      setSubtitlesEnabled(false);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to load subtitle.' };
    } finally {
      setLoadingSubtitles(false);
    }
  }, []);

  // Imports a .srt file the user already has on their device (via
  // expo-document-picker on the screen side) and feeds it into the same
  // rendering pipeline as remote/track subtitles.
  const loadLocalSubtitle = useCallback(async (uri, fileName) => {
    if (!uri) return { success: false, error: 'No file selected.' };
    if (!/\.srt$/i.test(fileName || uri)) {
      return { success: false, error: 'Unsupported subtitle format — only .srt files are supported right now.' };
    }

    setLoadingSubtitles(true);
    setParsedSubtitles([]);
    setCurrentSubtitleText('');
    try {
      const content = await LegacyFileSystem.readAsStringAsync(uri);
      const rawCues = parseSrt(content);
      const parsedWithSeconds = rawCues.map(line => ({
        ...line,
        startSeconds: timeToSeconds(line.start),
        endSeconds: timeToSeconds(line.end),
      }));

      if (parsedWithSeconds.length === 0) {
        setSubtitlesEnabled(false);
        return { success: false, error: 'Subtitle file contained no readable cues.' };
      }

      const code = `local:${fileName || 'imported'}`;
      setParsedSubtitles(parsedWithSeconds);
      lastSubtitleIndexRef.current = 0;
      setSelectedLanguage(code);
      setSubtitlesEnabled(true);
      setLocalSubtitleName(fileName || 'Imported subtitle');
      return { success: true, code };
    } catch (err) {
      console.error('Error loading local subtitle:', err);
      setSubtitlesEnabled(false);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to read subtitle file.' };
    } finally {
      setLoadingSubtitles(false);
    }
  }, []);

  const updateCurrentSubtitle = useCallback((currentPositionSeconds) => {
    if (!subtitlesEnabled || parsedSubtitles.length === 0) {
      if (currentSubtitleText !== '') setCurrentSubtitleText('');
      return;
    }

    let currentSub = null;
    const lastIdx = lastSubtitleIndexRef.current;

    if (lastIdx < parsedSubtitles.length &&
      currentPositionSeconds >= parsedSubtitles[lastIdx].startSeconds &&
      currentPositionSeconds <= parsedSubtitles[lastIdx].endSeconds) {
      currentSub = parsedSubtitles[lastIdx];
    } else {
      for (let i = Math.max(0, lastIdx - 2); i < Math.min(parsedSubtitles.length, lastIdx + 10); i++) {
        if (currentPositionSeconds >= parsedSubtitles[i].startSeconds &&
          currentPositionSeconds <= parsedSubtitles[i].endSeconds) {
          currentSub = parsedSubtitles[i];
          lastSubtitleIndexRef.current = i;
          break;
        }
      }

      if (!currentSub) {
        let low = 0;
        let high = parsedSubtitles.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const sub = parsedSubtitles[mid];

          if (currentPositionSeconds >= sub.startSeconds && currentPositionSeconds <= sub.endSeconds) {
            currentSub = sub;
            lastSubtitleIndexRef.current = mid;
            break;
          } else if (currentPositionSeconds < sub.startSeconds) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
      }
    }

    let newText = currentSub ? currentSub.text : '';

    if (newText) {
      newText = newText.replace(/<br\s*\/?>/gi, '\n');
      newText = newText.replace(/<\/?(i|b|u|font)[^>]*>/gi, '');
      newText = newText.trim();
    }

    if (newText !== currentSubtitleText) {
      setCurrentSubtitleText(newText);
    }
  }, [subtitlesEnabled, parsedSubtitles, currentSubtitleText]);

  return {
    availableLanguages,
    selectedLanguage,
    parsedSubtitles,
    currentSubtitleText,
    subtitlesEnabled,
    loadingSubtitles,
    localSubtitleName,
    preferredSubtitleLanguageLoadedRef,
    initialSubtitlePreferenceAppliedRef,
    setSubtitlesEnabled,
    loadSubtitlePreference,
    findSubtitles,
    selectSubtitle,
    loadTrackSubtitle,
    loadLocalSubtitle,
    updateCurrentSubtitle,
  };
};

