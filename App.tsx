import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// ── 에러 바운더리 (웹 흰 화면 방지) ──────────────────────────
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tabBarHeight = 74 + insets.bottom;
  const tabBarPaddingBottom = 10 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#4F8EF7',
        tabBarInactiveTintColor: '#bbb',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home: ['home', 'home-outline'],
            History: ['calendar', 'calendar-outline'],
            Exercises: ['barbell', 'barbell-outline'],
            Profile: ['person', 'person-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          const iconName = focused ? active : inactive;
          return <Ionicons name={iconName as any} size={size} color={color} />;
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
  );
}

function AppInner() {
  const alertRef = useRef<WebAlertRef>(null);
  const { colors } = useTheme();

  useEffect(() => {
    // 웹 Alert 모달 등록
    if (Platform.OS === 'web') {
      registerWebAlert((title, message, buttons) => {
        alertRef.current?.show(title, message, buttons);
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // 모바일 브라우저 viewport 높이 문제 수정 (100vh vs dvh)
    const setAppHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);

    // viewport-fit=cover 적용 (safe area inset 활성화)
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover',
      );
    }

    // dvh 지원 CSS 주입
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
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
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
      <AppInner />
    </ThemeProvider>
  );
}
