import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type ResponsiveLayout = {
  width: number;
  height: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isTabletSize: boolean;
  isCompact: boolean;
  isShortScreen: boolean;
  columns: number;
  horizontalPadding: number;
  contentMaxWidth: number;
  modalMaxWidth: number;
  sidebarWidth: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const shortestSide = Math.min(width, height);
    const isLandscape = width > height;
    const isTabletSize = shortestSide >= 600;
    const isCompact = width < 390;
    const isShortScreen = height < 500;

    return {
      width,
      height,
      isLandscape,
      isPortrait: !isLandscape,
      isTabletSize,
      isCompact,
      isShortScreen,
      columns:
        width >= 1100 ? 3 :
        width >= 700 ? 2 : 1,
      horizontalPadding:
        width >= 900 ? 28 :
        width >= 600 ? 24 : 16,
      contentMaxWidth: 1280,
      modalMaxWidth:
        width >= 900 ? 720 :
        width >= 600 ? 600 :
        Math.max(280, width - 32),
      sidebarWidth:
        width >= 1000 ? 280 : 0,
    };
  }, [width, height]);
}
