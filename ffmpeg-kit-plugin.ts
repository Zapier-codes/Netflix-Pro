const fs = require('fs');
const path = require('path');
const { withPlugins, withDangerousMod, withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const withFfmpegKitIos = (config: any, { iosUrl }: { iosUrl: string }) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg: any) => {
      const { platformProjectRoot } = cfg.modRequest;
      const podspecPath = path.join(platformProjectRoot, 'ffmpeg-kit-ios-full-gpl.podspec');
      const podspec = `
Pod::Spec.new do |s|
  s.name             = 'ffmpeg-kit-ios-full-gpl'
  s.version          = '6.0'
  s.summary          = 'Custom full-gpl FFmpegKit iOS frameworks'
  s.homepage         = 'https://github.com/arthenica/ffmpeg-kit'
  s.license          = { :type => 'LGPL' }
  s.author           = { 'Phoenix-Boss' => 'phoenixboss7492@gmail.com' }
  s.platform         = :ios, '12.1'
  s.static_framework = true
  s.source           = { :http => '${iosUrl}' }
  s.vendored_frameworks = [
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libswscale.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libswresample.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavutil.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavformat.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavfilter.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavdevice.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavcodec.xcframework',
    'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/ffmpegkit.xcframework'
  ]
end
`;
      fs.writeFileSync(podspecPath, podspec);
      return cfg;
    },
  ]);
};

const withFfmpegKitAndroid = (config: any, { androidUrl }: { androidUrl: string }) => {
  config = withDangerousMod(config, [
    'android',
    async (cfg: any) => {
      const { platformProjectRoot } = cfg.modRequest;
      const ffmpegKitBuildGradlePath = path.join(
        platformProjectRoot,
        '..',
        'node_modules',
        'ffmpeg-kit-react-native',
        'android',
        'build.gradle'
      );
      if (fs.existsSync(ffmpegKitBuildGradlePath)) {
        let buildGradle: string = fs.readFileSync(ffmpegKitBuildGradlePath, 'utf-8');
        const originalDependency = /implementation 'com\.arthenica:ffmpeg-kit-'.*/;
        const replacement = `implementation(name: 'ffmpeg-kit-full-gpl', ext: 'aar')`;
        if (buildGradle.match(originalDependency)) {
          buildGradle = buildGradle.replace(originalDependency, replacement);
          fs.writeFileSync(ffmpegKitBuildGradlePath, buildGradle);
        }
      }
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg: any) => {
    let buildGradle: string = cfg.modResults.contents;
    const appFlatDirLibsPath = '${projectDir}/../libs';
    const appFlatDirRepo = `
  repositories {
      flatDir { dirs "${appFlatDirLibsPath}" }
  }`;
    if (!buildGradle.match(/repositories\s*\{[\s\S]*?flatDir/)) {
      buildGradle = mergeContents({
        tag: 'ffmpeg-kit-app-flatdir-repo',
        src: buildGradle,
        newSrc: appFlatDirRepo,
        anchor: /android\s*\{/,
        offset: 1,
        comment: '//',
      }).contents;
    }
    const newDependencies = `  implementation(name: 'ffmpeg-kit-full-gpl', ext: 'aar')`;
    if (!buildGradle.includes("name: 'ffmpeg-kit-full-gpl', ext: 'aar'")) {
      buildGradle = mergeContents({
        tag: 'ffmpeg-kit-dependencies',
        src: buildGradle,
        newSrc: newDependencies,
        anchor: /dependencies\s*\{/,
        offset: 1,
        comment: '//',
      }).contents;
    }
    cfg.modResults.contents = buildGradle;
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg: any) => {
    let buildGradle: string = cfg.modResults.contents;
    const projectFlatDirLibsPath = '$rootDir/libs';
    const flatDirString = `        flatDir { dirs "${projectFlatDirLibsPath}" }`;
    if (!buildGradle.match(/flatDir\s*\{[\s\S]*?dirs\s*['"]\$rootDir\/libs['"]/)) {
      const match = buildGradle.match(/(allprojects\s*\{\s*repositories\s*\{)/);
      if (match) {
        const insertionPoint = match.index! + match[0].length;
        buildGradle = buildGradle.substring(0, insertionPoint) + '\n' + flatDirString + buildGradle.substring(insertionPoint);
      }
    }
    cfg.modResults.contents = buildGradle;
    return cfg;
  });

  return config;
};

module.exports = (config: any, options: { iosUrl: string; androidUrl: string } = { iosUrl: '', androidUrl: '' }) => {
  const { iosUrl, androidUrl } = options;
  if (!iosUrl) throw new Error('FFmpeg Kit plugin requires "iosUrl" option.');
  if (!androidUrl) throw new Error('FFmpeg Kit plugin requires "androidUrl" option.');
  return withPlugins(config, [
    (config: any) => withFfmpegKitIos(config, { iosUrl }),
    (config: any) => withFfmpegKitAndroid(config, { androidUrl }),
  ]);
};