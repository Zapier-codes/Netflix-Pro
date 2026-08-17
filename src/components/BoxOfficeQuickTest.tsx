// src/components/BoxOfficeQuickTest.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';

export function BoxOfficeQuickTest() {
  const runQuickTest = async () => {
    try {
      Alert.alert('BoxOffice', 'Testing...');
      const { boxOffice } = require('boxoffice');
      const status = await boxOffice.getStatus();
      Alert.alert('✅ Success', Status: \nRunning: );
    } catch (e: any) {
      Alert.alert('❌ Failed', e.message);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={runQuickTest}>
      <Text style={styles.buttonText}>🧪 Quick BoxOffice Test</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#E8A838',
    padding: 10,
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
