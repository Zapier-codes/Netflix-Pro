import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface CardProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({ title, subtitle, style }): React.JSX.Element => {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

interface Styles {
  card: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  card: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    margin: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    marginTop: 4,
  },
});

export default Card;
