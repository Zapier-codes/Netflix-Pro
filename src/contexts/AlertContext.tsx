// src/contexts/AlertContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from './ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  destructive?: boolean;
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  showDestructiveAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  showToast: (message: string, duration?: number) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, isDark } = useTheme();
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    destructive: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showAlert = useCallback((title: string, message?: string, buttons: AlertButton[] = [{ text: 'OK' }]) => {
    setAlertConfig({ visible: true, title, message, buttons, destructive: false });
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 100, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const showDestructiveAlert = useCallback((title: string, message?: string, buttons: AlertButton[] = [{ text: 'OK' }]) => {
    setAlertConfig({ visible: true, title, message, buttons, destructive: true });
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 100, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const showToast = useCallback((message: string, duration: number = 3000) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
    setToastMessage(message);
    Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    
    toastTimeout.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setToastMessage(null);
      });
    }, duration);
  }, []);

  const hideAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
    });
  }, []);

  const isDestructive = alertConfig.destructive;

  return (
    <AlertContext.Provider value={{ showAlert, showDestructiveAlert, showToast, hideAlert }}>
      {children}
      
      {/* Alert Modal */}
      <Modal visible={alertConfig.visible} transparent animationType="none" onRequestClose={hideAlert}>
        <Animated.View style={[styles.overlay, { opacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={hideAlert} />
          <Animated.View
            style={[
              styles.alertBox,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: isDestructive ? `${colors.error}50` : `${colors.gold}35`,
                borderWidth: 0.5,
                transform: [{ scale }],
              },
            ]}
          >
            <View style={[styles.topAccent, { backgroundColor: isDestructive ? colors.error : colors.gold }]} />
            <View style={[styles.iconRing, { 
              borderColor: isDestructive ? `${colors.error}60` : `${colors.gold}40`,
              backgroundColor: isDestructive ? `${colors.error}15` : `${colors.gold}12`
            }]}>
              <Ionicons 
                name={isDestructive ? 'alert-circle' : 'alert-circle-outline'} 
                size={28} 
                color={isDestructive ? colors.error : colors.gold} 
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{alertConfig.title}</Text>
            {alertConfig.message ? (
              <Text style={[styles.message, { color: isDark ? colors.textSub : '#555555' }]}>
                {alertConfig.message}
              </Text>
            ) : null}
            <View style={[styles.divider, { backgroundColor: isDestructive ? `${colors.error}25` : `${colors.gold}22` }]} />
            <View style={styles.buttonRow}>
              {alertConfig.buttons.map((btn, idx) => {
                const isDestructiveBtn = btn.style === 'destructive';
                const isCancelBtn = btn.style === 'cancel';
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.button,
                      idx < alertConfig.buttons.length - 1 && styles.buttonBorder,
                      isDestructiveBtn && styles.destructiveButton,
                    ]}
                    onPress={() => {
                      btn.onPress?.();
                      hideAlert();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.buttonText,
                      isDestructiveBtn && { color: colors.error, fontWeight: '700' },
                      isCancelBtn && { color: isDark ? colors.textMuted : '#888888', fontWeight: '500' },
                      !isDestructiveBtn && !isCancelBtn && { color: colors.gold, fontWeight: '700' },
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
      
      {/* Toast */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: colors.surfaceRaised }]}>
          <Text style={[styles.toastText, { color: colors.text }]}>{toastMessage}</Text>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  topAccent: { height: 3, width: '100%' },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 14,
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 6, 
    textAlign: 'center', 
    paddingHorizontal: 20,
  },
  message: { 
    fontSize: 13.5, 
    textAlign: 'center', 
    lineHeight: 20, 
    paddingHorizontal: 20, 
    marginBottom: 22,
  },
  divider: { height: 0.5, width: '100%' },
  buttonRow: { flexDirection: 'row', width: '100%' },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: {
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(212,175,55,0.2)',
  },
  destructiveButton: { backgroundColor: 'rgba(239,68,68,0.06)' },
  buttonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
  },
});