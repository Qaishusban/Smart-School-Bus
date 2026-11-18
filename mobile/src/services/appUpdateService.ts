import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export type AppUpdatePolicy = {
  platform: 'ios' | 'android';
  currentVersion: string;
  currentBuild: number;
  latestVersion: string;
  latestBuild: number;
  minimumBuild: number;
  updateAvailable: boolean;
  forceUpdate: boolean;
  storeUrl: string | null;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
};

type ReleaseRow = {
  platform: string;
  latest_version: string;
  latest_build: number;
  minimum_build: number;
  store_url: string | null;
  title_ar: string | null;
  title_en: string | null;
  message_ar: string | null;
  message_en: string | null;
  is_active: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isReleaseRow(value: unknown): value is ReleaseRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.platform === 'string' &&
    typeof value.latest_version === 'string' &&
    (
      typeof value.latest_build === 'number' ||
      typeof value.latest_build === 'string'
    ) &&
    (
      typeof value.minimum_build === 'number' ||
      typeof value.minimum_build === 'string'
    ) &&
    (
      value.store_url === null ||
      typeof value.store_url === 'string'
    ) &&
    (
      value.title_ar === null ||
      typeof value.title_ar === 'string'
    ) &&
    (
      value.title_en === null ||
      typeof value.title_en === 'string'
    ) &&
    (
      value.message_ar === null ||
      typeof value.message_ar === 'string'
    ) &&
    (
      value.message_en === null ||
      typeof value.message_en === 'string'
    ) &&
    typeof value.is_active === 'boolean'
  );
}

function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function getCurrentBuild(): number {
  if (Platform.OS === 'android') {
    const value =
      Constants.expoConfig?.android?.versionCode;

    const build =
      typeof value === 'number'
        ? value
        : Number(value ?? 0);

    return Number.isFinite(build) ? build : 0;
  }

  if (Platform.OS === 'ios') {
    const build = Number(
      Constants.expoConfig?.ios?.buildNumber ?? 0
    );

    return Number.isFinite(build) ? build : 0;
  }

  return 0;
}

export async function getAppUpdatePolicy(): Promise<AppUpdatePolicy | null> {
  if (
    Platform.OS !== 'android' &&
    Platform.OS !== 'ios'
  ) {
    return null;
  }

  const platform =
    Platform.OS as 'ios' | 'android';

  const { data, error } = await supabase
    .from('app_release_control')
    .select(
      [
        'platform',
        'latest_version',
        'latest_build',
        'minimum_build',
        'store_url',
        'title_ar',
        'title_en',
        'message_ar',
        'message_en',
        'is_active',
      ].join(',')
    )
    .eq('platform', platform)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.log(
      '[appUpdate] release policy read failed:',
      error.message
    );

    return null;
  }

  if (!data) {
    return null;
  }

  if (!isReleaseRow(data)) {
    console.log(
      '[appUpdate] invalid release policy row:',
      data
    );

    return null;
  }

  const row = data;

  const build = getCurrentBuild();

  const latestBuild = Number(
    row.latest_build ?? 0
  );

  const minimumBuild = Number(
    row.minimum_build ?? 0
  );

  return {
    platform,

    currentVersion: getCurrentVersion(),

    currentBuild: build,

    latestVersion: row.latest_version,

    latestBuild:
      Number.isFinite(latestBuild)
        ? latestBuild
        : 0,

    minimumBuild:
      Number.isFinite(minimumBuild)
        ? minimumBuild
        : 0,

    updateAvailable:
      Number.isFinite(latestBuild) &&
      latestBuild > build,

    forceUpdate:
      Number.isFinite(minimumBuild) &&
      minimumBuild > build,

    storeUrl: row.store_url,

    titleAr:
      row.title_ar ??
      'يتوفر تحديث جديد',

    titleEn:
      row.title_en ??
      'A new update is available',

    messageAr:
      row.message_ar ??
      'حدّث التطبيق للحصول على أحدث التحسينات والميزات.',

    messageEn:
      row.message_en ??
      'Update the app to get the latest improvements and features.',
  };
}