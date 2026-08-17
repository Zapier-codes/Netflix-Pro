// src/components/VidSrcQuickTest.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import tmdbScrape from 'vidsrc.extractor.module';

export function VidSrcQuickTest() {
  const runQuickTest = async () => {
    try {
      Alert.alert('VidSrc Test', 'Testing movie extraction...');
      
      const result = await tmdbScrape('27205', 'movie');
      
      if (result && result.length > 0) {
        Alert.alert(
          '✅ Success!',
          Found \ sources\nFirst: \
        );
        console.log('Result:', result);
      } else {
        Alert.alert('⚠️ No sources found');
      }
    } catch (e: any) {
      Alert.alert('❌ Failed', e.message);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={runQuickTest}>
      <Text style={styles.buttonText}>🧪 Quick VidSrc Test</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#E8A838',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    margin: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
