import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ── Error boundary ─────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FF5C5C', marginBottom: 12 }}>
            앱 오류 발생
          </Text>
          <Text style={{ fontSize: 13, color: '#555', textAlign: 'center' }}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

import { RootStackParamList, MainTabParamList } from './src/types';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AddWorkoutScreen from './src/screens/AddWorkoutScreen';
import WorkoutDetailScreen from './src/screens/WorkoutDetailScreen';
import ManageRoutinesScreen from './src/screens/ManageRoutinesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WebAlertModal, { WebAlertRef } from './src/components/WebAlertModal';
import { registerWebAlert } from './src/utils/alert';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { WorkoutProvider, useWorkout, MINI_BAR_HEIGHT } from './src/context/WorkoutContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ── Mini workout bar ──────────────────────────────────────────
function MiniWorkoutBar({
  onPress,
}: {
  onPress: () => void;
}) {
  const { activeWorkout, timerActive, timerSeconds } = useWorkout();
  const { colors } = useTheme();
  if (!activeWorkout) return null;

  const progress =
    activeWorkout.totalSets > 0
      ? activeWorkout.completedSets / activeWorkout.totalSets
      : 0;

  const formatMiniTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={[miniStyles.bar, { backgroundColor: colors.timerBg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={miniStyles.barLeft}>
        <Ionicons name="barbell-outline" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={miniStyles.barName} numberOfLines={1}>
          {activeWorkout.workoutName}
        </Text>
      </View>

      <View style={miniStyles.barCenter}>
        <View style={miniStyles.miniTrack}>
          <View style={[miniStyles.miniFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={miniStyles.barProgress}>
          {activeWorkout.completedSets}/{activeWorkout.totalSets}
        </Text>
      </View>

      {timerActive && (
        <View style={miniStyles.barTimer}>
          <Ionicons name="timer-outline" size={12} color="#4F8EF7" />
          <Text style={miniStyles.barTimerText}>{formatMiniTime(timerSeconds)}</Text>
        </View>
      )}

      <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

const miniStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MINI_BAR_HEIGHT,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  barLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  barName: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  barCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniTrack: { width: 60, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: 4, backgroundColor: '#4F8EF7', borderRadius: 2 },
  barProgress: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  barTimer: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(79,142,247,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  barTimerText: { fontSize: 12, color: '#4F8EF7', fontWeight: '700' },
});

// ── Main tabs ─────────────────────────────────────────────────
function MainTabs({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activeWorkout } = useWorkout();
  const { width } = useWindowDimensions();

  const isLarge = width >= 600;
  const isMedium = width >= 400;

  const iconSize = isLarge ? 26 : 22;
  const labelSize = isLarge ? 13 : 11;
  const tabBarHeight = isLarge ? 80 : 74;
  const totalTabBarHeight = tabBarHeight + insets.bottom + (activeWorkout ? MINI_BAR_HEIGHT : 0);
  const paddingBottom = (isLarge ? 12 : 10) + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '700', fontSize: isLarge ? 20 : 18, color: colors.text },
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            height: tabBarHeight + insets.bottom + (activeWorkout ? MINI_BAR_HEIGHT : 0),
            paddingBottom: paddingBottom + (activeWorkout ? MINI_BAR_HEIGHT : 0),
            paddingTop: isLarge ? 10 : 8,
          },
          tabBarActiveTintColor: '#4F8EF7',
          tabBarInactiveTintColor: '#bbb',
          tabBarLabelStyle: { fontSize: labelSize, fontWeight: '600', marginTop: 2 },
          tabBarIcon: ({ focused, color }) => {
            const icons: Record<string, [string, string]> = {
              Home: ['home', 'home-outline'],
              History: ['calendar', 'calendar-outline'],
              Exercises: ['barbell', 'barbell-outline'],
              Profile: ['person', 'person-outline'],
            };
            const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={(focused ? active : inactive) as any} size={iconSize} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: '피티마스터', tabBarLabel: '홈' }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: '운동 기록', tabBarLabel: '기록' }}
        />
        <Tab.Screen
          name="Exercises"
          component={ExercisesScreen}
          options={{ title: '운동 목록', tabBarLabel: '운동' }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: '내 정보', tabBarLabel: '프로필' }}
        />
      </Tab.Navigator>

      {/* Mini workout bar – sits above tab bar */}
      {activeWorkout && (
        <View
          style={{
            position: 'absolute',
            bottom: tabBarHeight + insets.bottom,
            left: 0,
            right: 0,
          }}
        >
          <MiniWorkoutBar
            onPress={() =>
              navigation.navigate('WorkoutDetail', { workoutId: activeWorkout.workoutId })
            }
          />
        </View>
      )}
    </View>
  );
}

function AppInner() {
  const alertRef = useRef<WebAlertRef>(null);
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web') {
      registerWebAlert((title, message, buttons) => {
        alertRef.current?.show(title, message, buttons);
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const setAppHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);

    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover',
      );
    }

    const style = document.createElement('style');
    style.textContent = `
      html, body, #root {
        height: 100%;
        height: 100dvh;
        overflow: hidden;
      }
      * { -webkit-tap-highlight-color: transparent; }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ backgroundColor: colors.background }}>
        <NavigationContainer>
          <StatusBar style={colors.background === '#0D0D1A' ? 'light' : 'dark'} />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTitleStyle: { fontWeight: '700', color: colors.text },
              headerTintColor: colors.primary,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
              {(props) => <MainTabs navigation={props.navigation as any} />}
            </Stack.Screen>
            <Stack.Screen
              name="AddWorkout"
              component={AddWorkoutScreen}
              options={{ title: '운동 추가', presentation: 'modal' }}
            />
            <Stack.Screen
              name="WorkoutDetail"
              component={WorkoutDetailScreen}
              options={{ title: '운동 상세' }}
            />
            <Stack.Screen
              name="ManageRoutines"
              component={ManageRoutinesScreen}
              options={{ title: '루틴 관리' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: '설정' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        {Platform.OS === 'web' && <WebAlertModal ref={alertRef} />}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <WorkoutProvider>
        <AppInner />
      </WorkoutProvider>
    </ThemeProvider>
  );
}
