import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

type StartupSplashProps = {
  onFinish: () => void;
  duration?: number;
};

export default function StartupSplash({
  onFinish,
  duration = 3200,
}: StartupSplashProps) {
  const progress =
    useRef(new Animated.Value(0)).current;

  const contentOpacity =
    useRef(new Animated.Value(0)).current;

  const contentTranslate =
    useRef(new Animated.Value(14)).current;

  const logoScale =
    useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),

      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),

      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),

      Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [
    contentOpacity,
    contentTranslate,
    duration,
    logoScale,
    onFinish,
    progress,
  ]);

  const progressWidth =
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['3%', '100%'],
    });

  return (
    <View style={styles.root}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ImageBackground
        source={require('../../../assets/splash-background.png')}
        resizeMode="cover"
        style={styles.background}
      >
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: contentOpacity,
                transform: [
                  {
                    translateY:
                      contentTranslate,
                  },
                ],
              },
            ]}
          >
            {/* TOP BRANDING */}
            <View style={styles.topSection}>
              <Animated.View
                style={[
                  styles.logoWrap,
                  {
                    transform: [
                      {
                        scale: logoScale,
                      },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('../../../assets/smart-school-bus-logo-transparent.png')}
                  resizeMode="contain"
                  style={styles.logo}
                />
              </Animated.View>

              <Text style={styles.arabicTitle}>
                رحلة آمنة .. لمستقبل أفضل
              </Text>

              <Text style={styles.englishTitle}>
                A safer journey. A brighter future.
              </Text>
            </View>

            {/* BOTTOM */}
            <View style={styles.bottomSection}>
              <View style={styles.featuresCard}>
                <View style={styles.feature}>
                  <View
                    style={[
                      styles.featureIcon,
                      styles.greenIcon,
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={24}
                      color="#FFFFFF"
                    />
                  </View>

                  <Text style={styles.featureArabic}>
                    أمان أكثر
                  </Text>

                  <Text style={styles.featureEnglish}>
                    Safer
                  </Text>
                </View>

                <View style={styles.separator} />

                <View style={styles.feature}>
                  <View
                    style={[
                      styles.featureIcon,
                      styles.blueIcon,
                    ]}
                  >
                    <Ionicons
                      name="people-outline"
                      size={25}
                      color="#FFFFFF"
                    />
                  </View>

                  <Text style={styles.featureArabic}>
                    تواصل أفضل
                  </Text>

                  <Text style={styles.featureEnglish}>
                    Better Connection
                  </Text>
                </View>

                <View style={styles.separator} />

                <View style={styles.feature}>
                  <View
                    style={[
                      styles.featureIcon,
                      styles.goldIcon,
                    ]}
                  >
                    <Ionicons
                      name="bar-chart-outline"
                      size={24}
                      color="#FFFFFF"
                    />
                  </View>

                  <Text style={styles.featureArabic}>
                    مستقبل أشرق
                  </Text>

                  <Text style={styles.featureEnglish}>
                    Brighter Future
                  </Text>
                </View>
              </View>

              <Text style={styles.loadingText}>
                جاري التحميل...
              </Text>

              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth,
                    },
                  ]}
                />
              </View>

              <View style={styles.dots}>
                <View style={styles.dot} />

                <View
                  style={[
                    styles.dot,
                    styles.activeDot,
                  ]}
                />

                <View style={styles.dot} />
              </View>

              <Text style={styles.footer}>
                SMART SCHOOL BUS
              </Text>
            </View>
          </Animated.View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07131F',
  },

  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(4, 20, 32, 0.25)',
  },

  safeArea: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 18,
  },

  topSection: {
    alignItems: 'center',
  },

  /*
   * لا يوجد صندوق أبيض.
   * اللوجو نفسه فقط.
   */
  logoWrap: {
    width: 210,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },

  logo: {
    width: 195,
    height: 135,
  },

  arabicTitle: {
    marginTop: 12,

    color: '#FFFFFF',

    fontSize: 26,
    lineHeight: 37,

    fontWeight: '900',
    textAlign: 'center',

    textShadowColor:
      'rgba(0,0,0,0.55)',

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 8,
  },

  englishTitle: {
    marginTop: 4,

    color:
      'rgba(255,255,255,0.94)',

    fontSize: 13,
    lineHeight: 20,

    fontWeight: '700',
    textAlign: 'center',

    textShadowColor:
      'rgba(0,0,0,0.55)',

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 6,
  },

  bottomSection: {
    width: '100%',
  },

  featuresCard: {
    minHeight: 126,

    borderRadius: 29,

    backgroundColor:
      'rgba(4,25,40,0.79)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.14)',

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 8,
    paddingVertical: 17,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.22,
    shadowRadius: 18,

    elevation: 8,
  },

  feature: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  separator: {
    width: 1,
    height: 70,

    backgroundColor:
      'rgba(255,255,255,0.23)',
  },

  featureIcon: {
    width: 48,
    height: 48,

    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 8,
  },

  greenIcon: {
    backgroundColor:
      'rgba(16,170,105,0.72)',
  },

  blueIcon: {
    backgroundColor:
      'rgba(49,151,245,0.72)',
  },

  goldIcon: {
    backgroundColor:
      'rgba(244,185,66,0.65)',
  },

  featureArabic: {
    color: '#FFFFFF',

    fontSize: 11,
    lineHeight: 17,

    fontWeight: '900',

    textAlign: 'center',
  },

  featureEnglish: {
    marginTop: 2,

    color:
      'rgba(255,255,255,0.74)',

    fontSize: 7.5,
    lineHeight: 11,

    fontWeight: '700',

    textAlign: 'center',
  },

  loadingText: {
    marginTop: 18,

    color: '#FFFFFF',

    fontSize: 16,
    lineHeight: 23,

    fontWeight: '800',

    textAlign: 'center',

    textShadowColor:
      'rgba(0,0,0,0.55)',

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 6,
  },

  progressTrack: {
    height: 8,

    marginTop: 11,
    marginHorizontal: 10,

    borderRadius: 999,

    overflow: 'hidden',

    backgroundColor:
      'rgba(230,239,247,0.65)',

    borderWidth: 1,

    borderColor:
      'rgba(255,255,255,0.24)',
  },

  progressFill: {
    height: '100%',

    borderRadius: 999,

    backgroundColor: '#F4B942',
  },

  dots: {
    marginTop: 14,

    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    gap: 9,
  },

  dot: {
    width: 7,
    height: 7,

    borderRadius: 4,

    backgroundColor:
      'rgba(255,255,255,0.52)',
  },

  activeDot: {
    width: 10,
    height: 10,

    borderRadius: 5,

    backgroundColor: '#F4B942',
  },

  footer: {
    marginTop: 12,

    color:
      'rgba(255,255,255,0.84)',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 3.2,

    textAlign: 'center',
  },
});