// src/screens/VidSrcTestScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';

// Import the vidsrc extractor
import tmdbScrape from 'vidsrc.extractor.module';

export function VidSrcTestScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string, isError: boolean = false) => {
    const prefix = isError ? '❌' : '✅';
    setLogs(prev => [...prev, \ \]);
  };

  const testMovie = async () => {
    setLoading(true);
    setLogs([]);
    addLog('🔍 Testing movie extraction: Inception (27205)');
    
    try {
      const result = await tmdbScrape('27205', 'movie');
      if (result && result.length > 0) {
        addLog(Found \ sources);
        result.forEach((item: any, i: number) => {
          addLog(  \. \ - \...);
        });
        addLog('✅ Movie test complete!');
      } else {
        addLog('⚠️ No sources found', true);
      }
    } catch (error: any) {
      addLog(Error: \, true);
    } finally {
      setLoading(false);
    }
  };

  const testTV = async () => {
    setLoading(true);
    setLogs([]);
    addLog('🔍 Testing TV extraction: Breaking Bad S1E1 (1396, 1, 1)');
    
    try {
      const result = await tmdbScrape('1396', 'tv', 1, 1);
      if (result && result.length > 0) {
        addLog(Found \ sources);
        result.forEach((item: any, i: number) => {
          addLog(  \. \ - \...);
        });
        addLog('✅ TV test complete!');
      } else {
        addLog('⚠️ No sources found', true);
      }
    } catch (error: any) {
      addLog(Error: \, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎬 VidSrc Extractor Test</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.movieButton]}
          onPress={testMovie}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Movie</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.tvButton]}
          onPress={testTV}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test TV</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color="#E8A838" />}

      <Text style={styles.logsTitle}>📋 Logs</Text>
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.logPlaceholder}>Press a button to test</Text>
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  movieButton: {
    backgroundColor: '#4CAF50',
  },
  tvButton: {
    backgroundColor: '#2196F3',
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

export default VidSrcTestScreen;
