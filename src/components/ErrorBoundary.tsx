// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.icon, { color: colors.error }]}>⚠️</Text>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.textSub }]}>
        {error?.message || 'An unexpected error occurred'}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.gold }]}
        onPress={() => {
          // Reload the app
          window.location?.reload?.();
        }}
      >
        <Text style={[styles.buttonText, { color: '#000000' }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export const ErrorBoundary: React.FC<Props> = (props) => {
  const { colors } = useTheme();
  
  return (
    <ErrorBoundaryClass 
      {...props} 
      fallback={
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.icon, { color: colors.error }]}>⚠️</Text>
          <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
          <Text style={[styles.message, { color: colors.textSub }]}>
            Please restart the app
          </Text>
        </View>
      }
    />
  );
};

export default ErrorBoundary;
