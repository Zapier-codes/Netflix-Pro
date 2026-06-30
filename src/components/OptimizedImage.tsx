// src/components/OptimizedImage.tsx
import React, { useState, useEffect } from 'react';
import { Image, ImageProps, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface OptimizedImageProps extends ImageProps {
  fallbackColor?: string;
  thumbnail?: string;
  blurRadius?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  fallbackColor,
  thumbnail,
  blurRadius = 0,
  ...props
}) => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (thumbnail) {
      Image.prefetch(thumbnail).catch(() => {});
    }
  }, [thumbnail]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const backgroundColor = fallbackColor || colors.surfaceRaised;

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {isLoading && (
        <View style={[styles.loadingContainer, { backgroundColor }]}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      )}
      <Image
        {...props}
        source={source}
        style={[style, isLoading && styles.hidden]}
        onLoad={handleLoad}
        onError={handleError}
        progressiveRenderingEnabled
        fadeDuration={300}
      />
      {hasError && (
        <View style={[styles.errorContainer, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Failed to load</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hidden: {
    opacity: 0,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
