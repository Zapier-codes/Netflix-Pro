// src/screens/BoxOfficeTestScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { boxOffice, SubjectType, ApiVersion } from 'boxoffice';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export function BoxOfficeTestScreen() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Module Load', status: 'idle' },
    { name: 'Status Check', status: 'idle' },
    { name: 'Search Movies', status: 'idle' },
    { name: 'Search TV Series', status: 'idle' },
    { name: 'Get Download URLs', status: 'idle' },
    { name: 'Get Movie Details', status: 'idle' },
    { name: 'Download Movie', status: 'idle' },
  ]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string, isError: boolean = false) => {
    setLogs(prev => [...prev, ${new Date().toLocaleTimeString()}:  ]);
  };

  const updateTest = (name: string, status: 'idle' | 'running' | 'success' | 'error', message?: string, data?: any) => {
    setTests(prev => prev.map(t => 
      t.name === name ? { ...t, status, message, data } : t
    ));
  };

  const runTests = async () => {
    setIsRunning(true);
    setLogs([]);
    
    try {
      // Test 1: Module Load
      addLog('Testing module load...');
      updateTest('Module Load', 'running');
      try {
        const { boxOffice: bo, SubjectType: st, ApiVersion: av } = require('boxoffice');
        addLog('Module loaded successfully');
        updateTest('Module Load', 'success');
      } catch (e: any) {
        addLog(Module load failed: , true);
        updateTest('Module Load', 'error', e.message);
        setIsRunning(false);
        return;
      }

      // Test 2: Status Check
      addLog('Checking engine status...');
      updateTest('Status Check', 'running');
      try {
        const status = await boxOffice.getStatus();
        addLog(Status: , Running: );
        updateTest('Status Check', 'success', undefined, status);
      } catch (e: any) {
        addLog(Status check failed: , true);
        updateTest('Status Check', 'error', e.message);
      }

      // Test 3: Search Movies
      addLog('Searching for movies...');
      updateTest('Search Movies', 'running');
      try {
        const results = await boxOffice.search(
          'Inception',
          1,
          5,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        addLog(Found  movies);
        if (results.items && results.items.length > 0) {
          results.items.slice(0, 3).forEach((item: any, i: number) => {
            addLog(  .  ());
          });
        }
        updateTest('Search Movies', 'success', undefined, results);
      } catch (e: any) {
        addLog(Movie search failed: , true);
        updateTest('Search Movies', 'error', e.message);
      }

      // Test 4: Search TV Series
      addLog('Searching for TV series...');
      updateTest('Search TV Series', 'running');
      try {
        const results = await boxOffice.search(
          'Breaking Bad',
          1,
          5,
          SubjectType.TV_SERIES,
          ApiVersion.V2
        );
        addLog(Found  TV series);
        if (results.items && results.items.length > 0) {
          results.items.slice(0, 3).forEach((item: any, i: number) => {
            addLog(  .  ());
          });
        }
        updateTest('Search TV Series', 'success', undefined, results);
      } catch (e: any) {
        addLog(TV series search failed: , true);
        updateTest('Search TV Series', 'error', e.message);
      }

      // Test 5: Get Download URLs
      addLog('Getting download URLs...');
      updateTest('Get Download URLs', 'running');
      try {
        const searchResults = await boxOffice.search(
          'Inception',
          1,
          1,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        
        if (searchResults.items && searchResults.items.length > 0) {
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
            files.downloads.slice(0, 3).forEach((dl: any, i: number) => {
              addLog(  . p - MB);
            });
          }
          updateTest('Get Download URLs', 'success', undefined, files);
        } else {
          addLog('No movies found to test download', true);
          updateTest('Get Download URLs', 'error', 'No movies found');
        }
      } catch (e: any) {
        addLog(Get download URLs failed: , true);
        updateTest('Get Download URLs', 'error', e.message);
      }

      // Test 6: Get Movie Details
      addLog('Getting movie details...');
      updateTest('Get Movie Details', 'running');
      try {
        const searchResults = await boxOffice.search(
          'Inception',
          1,
          1,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        
        if (searchResults.items && searchResults.items.length > 0) {
          const movie = searchResults.items[0];
          const details = await boxOffice.getMovieDetails(
            movie.subjectId,
            ApiVersion.V1
          );
          addLog(Details: );
          addLog(Year: );
          addLog(Rating: );
          addLog(Genres: );
          updateTest('Get Movie Details', 'success', undefined, details);
        } else {
          addLog('No movies found to get details', true);
          updateTest('Get Movie Details', 'error', 'No movies found');
        }
      } catch (e: any) {
        addLog(Get movie details failed: , true);
        updateTest('Get Movie Details', 'error', e.message);
      }

      // Test 7: Download Movie
      addLog('Testing download capability...');
      updateTest('Download Movie', 'running');
      try {
        const searchResults = await boxOffice.search(
          'Inception',
          1,
          1,
          SubjectType.MOVIES,
          ApiVersion.V2
        );
        
        if (searchResults.items && searchResults.items.length > 0) {
          const movie = searchResults.items[0];
          addLog(Ready to download: );
          addLog(⚠️ Actual download skipped in test mode);
          addLog(   To test download, enable in production);
          updateTest('Download Movie', 'success', 'Download ready');
        } else {
          addLog('No movies found to test download', true);
          updateTest('Download Movie', 'error', 'No movies found');
        }
      } catch (e: any) {
        addLog(Download test failed: , true);
        updateTest('Download Movie', 'error', e.message);
      }

      addLog('✅ All tests complete!');
    } catch (e: any) {
      addLog(Test suite error: , true);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'running': return '#FFC107';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'running': return '⏳';
      default: return '⏸️';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BoxOffice SDK Test</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runTests}
        disabled={isRunning}
      >
        {isRunning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run All Tests</Text>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.testsContainer}>
        {tests.map((test, index) => (
          <View key={index} style={styles.testItem}>
            <View style={styles.testHeader}>
              <Text style={styles.testName}>{test.name}</Text>
              <View style={[styles.testStatus, { backgroundColor: getStatusColor(test.status) }]}>
                <Text style={styles.testStatusText}>
                  {getStatusIcon(test.status)} {test.status}
                </Text>
              </View>
            </View>
            {test.message && (
              <Text style={styles.testMessage}>{test.message}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      <Text style={styles.logsTitle}>📋 Logs</Text>
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
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
  testsContainer: {
    maxHeight: 300,
    marginBottom: 12,
  },
  testItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  testStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  testStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  testMessage: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
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
    minHeight: 100,
    maxHeight: 200,
  },
  logText: {
    color: '#aaa',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

export default BoxOfficeTestScreen;
