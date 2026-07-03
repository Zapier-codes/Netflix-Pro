import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getBadgeInfo } from '../utils/badgeHelper';

const Badge = ({
  mediaType,
  releaseDate,
  firstAirDate,
  lastAirDate,
  isLive,
  isUpcoming,
  hasWatched = false,
}) => {
  // ─── Live / Upcoming badges (unrelated to recency tiers, unchanged) ───
  if (isLive !== undefined) {
    if (isUpcoming) {
      return (
        <View style={styles.upcomingBadge}>
          <Text style={styles.upcomingBadgeText}>SOON</Text>
        </View>
      );
    }

    return (
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    );
  }

  // ─── Recency badge: Hot / New / Latest / none, via shared helper ───
  const badgeInfo = getBadgeInfo({
    mediaType,
    releaseDate,
    firstAirDate,
    lastAirDate,
    hasWatched,
  });

  if (!badgeInfo) {
    return null;
  }

  return (
    <View style={[styles.newBadge, { backgroundColor: badgeInfo.color }]}>
      <Text style={styles.newBadgeText}>{badgeInfo.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF0000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 1,
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  liveBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  upcomingBadge: {
    position: 'absolute',
    top: 8,
    left: 0,
    backgroundColor: '#666666',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 1,
  },
  upcomingBadgeText: {
    color: '#CCCCCC',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default Badge;