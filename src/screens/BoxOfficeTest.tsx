// src/screens/BoxOfficeTest.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';

export function BoxOfficeTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (msg: string, isError: boolean = false) => {
    const prefix = isError ? '❌' : '✅';
    setLogs(prev => [...prev, ${new Date().toLocaleTimeString()}:  ]);
  };

  const runTest = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog('Starting BoxOffice test...', false);
    
    try {
      // Try to import BoxOffice
      addLog('Loading BoxOffice module...');
      let boxOffice, SubjectType, ApiVersion;
      
      try {
        const module = require('boxoffice');
        boxOffice = module.boxOffice || module.default || module;
        SubjectType = module.SubjectType || { MOVIES: 'MOVIES', TV_SERIES: 'TV_SERIES' };
        ApiVersion = module.ApiVersion || { V1: 'v1', V2: 'v2' };
        addLog('BoxOffice loaded successfully');
        addLog(Available: );
      } catch (e) {
        addLog(BoxOffice not found: , true);
        setIsRunning(false);
        return;
      }

      // Test 1: Status
      addLog('Testing status...');
      try {
        const status = await boxOffice.getStatus();
        addLog(Status: , Running: );
      } catch (e) {
        addLog(Status failed: , true);
      }

      // Test 2: Search Movies
      addLog('Testing movie search...');
      try {
        const results = await boxOffice.search(
          'Inception',
          1,
          3,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        const count = results.items?.length || 0;
        addLog(Search found  movies);
        if (count > 0) {
          results.items.slice(0, 3).forEach((item: any, i: number) => {
            addLog(  .  ());
          });
        }
      } catch (e) {
        addLog(Search failed: , true);
      }

      // Test 3: Search TV Series
      addLog('Testing TV series search...');
      try {
        const results = await boxOffice.search(
          'Breaking Bad',
          1,
          3,
          SubjectType.TV_SERIES,
          ApiVersion.V2
        );
        const count = results.items?.length || 0;
        addLog(Search found  TV series);
        if (count > 0) {
          results.items.slice(0, 3).forEach((item: any, i: number) => {
            addLog(  .  ());
          });
        }
      } catch (e) {
        addLog(TV search failed: , true);
      }

      // Test 4: Get Download URLs
      addLog('Testing download URLs...');
      try {
        const searchResults = await boxOffice.search(
          'Inception',
          1,
          1,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        
        if (searchResults.items?.length > 0) {
          const movie = searchResults.items[0];
          addLog(Movie:  ());
          
          const files = await boxOffice.getDownloadableFiles(
            movie.subjectId,
            SubjectType.MOVIES,
            ApiVersion.V1
          );
          addLog(Has resource: );
          addLog(Downloads: );
          addLog(Captions: );
          
          if (files.downloads.length > 0) {
            files.downloads.slice(0, 3).forEach((dl: any) => {
              addLog(  p - MB);
            });
          }
        }
      } catch (e) {
        addLog(Download test failed: , true);
      }

      // Test 5: Get Movie Details
      addLog('Testing movie details...');
      try {
        const searchResults = await boxOffice.search(
          'Inception',
          1,
          1,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        
        if (searchResults.items?.length > 0) {
          const movie = searchResults.items[0];
          const details = await boxOffice.getMovieDetails(
            movie.subjectId,
            ApiVersion.V1
          );
          addLog(Details: );
          addLog(Year: );
          addLog(Rating: );
          addLog(Genres: );
        }
      } catch (e) {
        addLog(Details failed: , true);
      }

      addLog('Test complete!');
    } catch (e) {
      addLog(Error: , true);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎬 BoxOffice SDK Test</Text>
        <Text style={styles.subtitle}>Test your BoxOffice integration</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runTest}
        disabled={isRunning}
      >
        {isRunning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>🚀 Run All Tests</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.logsTitle}>📋 Test Logs</Text>
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.logPlaceholder}>Press the button to run tests</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#E8A838',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 10,
    minHeight: 200,
    maxHeight: 400,
  },
  logText: {
    color: '#4CAF50',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  logPlaceholder: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 80,
  },
});

export default BoxOfficeTest;
