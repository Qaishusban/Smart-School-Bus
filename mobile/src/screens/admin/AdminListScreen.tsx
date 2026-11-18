import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAuth,
} from '../../hooks/useAuth';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  AdminRow,
  adminRowName,
  adminRowSubtitle,
  getAdminRows,
} from '../../services/adminService';

export type AdminListScreenProps = {
  table: string;
  icon:
    React.ComponentProps<
      typeof Ionicons
    >['name'];
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  schoolScoped?: boolean;
  orderBy?: string;
  emptyAr?: string;
  emptyEn?: string;
  secondary?: (
    row: AdminRow
  ) => string;
};

export default function AdminListScreen({
  table,
  icon,
  titleAr,
  titleEn,
  subtitleAr,
  subtitleEn,
  schoolScoped = true,
  orderBy = 'created_at',
  emptyAr = 'لا توجد بيانات.',
  emptyEn = 'No data found.',
  secondary,
}: AdminListScreenProps) {
  const {
    user,
  } = useAuth();

  const {
    theme,
  } = useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [
    rows,
    setRows,
  ] =
    useState<
      AdminRow[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async (
        refresh =
          false
      ) => {
        if (
          refresh
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError(
          null
        );

        try {
          const result =
            await getAdminRows({
              table,
              schoolId:
                user?.school_id ??
                null,
              schoolScoped,
              orderBy,
              limit:
                300,
            });

          setRows(
            result
          );
        } catch (
          loadError: any
        ) {
          setRows(
            []
          );

          setError(
            loadError?.message ??
              String(
                loadError
              )
          );
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      [
        table,
        user?.school_id,
        schoolScoped,
        orderBy,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const visible =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (!term) {
          return rows;
        }

        return rows.filter(
          (
            row
          ) => {
            const blob =
              [
                adminRowName(
                  row
                ),
                secondary
                  ? secondary(
                      row
                    )
                  : adminRowSubtitle(
                      row
                    ),
                row.code,
                row.bus_number,
                row.username,
                row.email,
                row.phone,
                row.phone_number,
                row.status,
                row.type,
              ]
                .filter(
                  Boolean
                )
                .join(
                  ' '
                )
                .toLowerCase();

            return blob.includes(
              term
            );
          }
        );
      },
      [
        rows,
        search,
        secondary,
      ]
    );

  if (
    loading
  ) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.colors
                .background,
          },
        ]}
      >
        <View
          style={
            styles.loadingIcon
          }
        >
          <Ionicons
            name={icon}
            size={31}
            color="#0A2D44"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#F7B83A"
          style={{
            marginTop:
              16,
          }}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                theme.colors
                  .textSecondary,
            },
          ]}
        >
          {isRTL
            ? 'جاري تحميل البيانات...'
            : 'Loading data...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            theme.colors
              .background,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.colors
                .surface,
            borderColor:
              theme.colors
                .border,
            flexDirection:
              direction,
          },
        ]}
      >
        <View
          style={
            styles.headerIcon
          }
        >
          <Ionicons
            name={icon}
            size={24}
            color="#0A2D44"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={[
              styles.headerTitle,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? titleAr
              : titleEn}
          </Text>

          <Text
            style={[
              styles.headerSubtitle,
              {
                color:
                  theme.colors
                    .textSecondary,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? `${subtitleAr} • ${rows.length}`
              : `${subtitleEn} • ${rows.length}`}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            void load(
              true
            )
          }
          style={
            styles.refreshButton
          }
        >
          <Ionicons
            name="refresh"
            size={20}
            color="#0A2D44"
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchBox,
          {
            backgroundColor:
              theme.colors
                .surface,
            borderColor:
              theme.colors
                .border,
            flexDirection:
              direction,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={19}
          color={
            theme.colors
              .textSecondary
          }
        />

        <TextInput
          value={
            search
          }
          onChangeText={
            setSearch
          }
          placeholder={
            isRTL
              ? 'بحث...'
              : 'Search...'
          }
          placeholderTextColor={
            theme.colors
              .textSecondary
          }
          style={[
            styles.searchInput,
            {
              color:
                theme.colors
                  .text,
              textAlign,
            },
          ]}
        />

        {!!search && (
          <Pressable
            onPress={() =>
              setSearch('')
            }
          >
            <Ionicons
              name="close-circle"
              size={19}
              color="#98A2B3"
            />
          </Pressable>
        )}
      </View>

      {!!error && (
        <View
          style={[
            styles.errorCard,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <Ionicons
            name="warning-outline"
            size={20}
            color="#FFFFFF"
          />
          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      )}

      <FlatList
        data={
          visible
        }
        keyExtractor={(
          item,
          index
        ) =>
          String(
            item.id ??
              index
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            tintColor="#F7B83A"
            onRefresh={() =>
              void load(
                true
              )
            }
          />
        }
        contentContainerStyle={
          visible.length
            ? styles.list
            : styles.emptyList
        }
        renderItem={({
          item,
          index,
        }) => {
          const title =
            adminRowName(
              item
            ) ||
            `${isRTL ? 'سجل' : 'Record'} ${
              index +
              1
            }`;

          const subtitle =
            secondary
              ? secondary(
                  item
                )
              : adminRowSubtitle(
                  item
                );

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    theme.colors
                      .surface,
                  borderColor:
                    theme.colors
                      .border,
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.cardIcon
                }
              >
                <Ionicons
                  name={
                    icon
                  }
                  size={21}
                  color="#0A2D44"
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.cardTitle,
                    {
                      color:
                        theme.colors
                          .text,
                      textAlign,
                    },
                  ]}
                >
                  {title}
                </Text>

                <Text
                  numberOfLines={
                    2
                  }
                  style={[
                    styles.cardSubtitle,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {subtitle ||
                    (
                      isRTL
                        ? 'لا توجد تفاصيل إضافية'
                        : 'No additional details'
                    )}
                </Text>

                {!!item.status && (
                  <View
                    style={
                      styles.statusBadge
                    }
                  >
                    <Text
                      style={
                        styles.statusText
                      }
                    >
                      {String(
                        item.status
                      )}
                    </Text>
                  </View>
                )}
              </View>

              <Ionicons
                name={
                  isRTL
                    ? 'chevron-back'
                    : 'chevron-forward'
                }
                size={18}
                color="#98A2B3"
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            style={
              styles.empty
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name={`${String(icon).replace('-outline', '')}-outline` as any}
                size={34}
                color="#98A2B3"
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color:
                    theme.colors
                      .text,
                },
              ]}
            >
              {isRTL
                ? emptyAr
                : emptyEn}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    loadingIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    loadingText: {
      marginTop: 10,
      fontSize: 10,
      fontWeight:
        '700',
    },
    header: {
      marginHorizontal:
        14,
      marginTop: 6,
      minHeight: 74,
      paddingHorizontal:
        12,
      borderWidth: 1,
      borderRadius: 22,
      alignItems:
        'center',
      gap: 10,
    },
    headerIcon: {
      width: 47,
      height: 47,
      borderRadius: 16,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight:
        '900',
    },
    headerSubtitle: {
      marginTop: 2,
      fontSize: 9,
      fontWeight:
        '600',
    },
    refreshButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#FFF8E7',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    searchBox: {
      height: 48,
      marginHorizontal:
        14,
      marginTop: 11,
      paddingHorizontal:
        12,
      borderWidth: 1,
      borderRadius: 16,
      alignItems:
        'center',
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 11,
      fontWeight:
        '600',
    },
    errorCard: {
      marginHorizontal:
        14,
      marginTop: 9,
      minHeight: 48,
      paddingHorizontal:
        11,
      borderRadius: 15,
      backgroundColor:
        '#C74444',
      alignItems:
        'center',
      gap: 8,
    },
    errorText: {
      flex: 1,
      color:
        '#FFFFFF',
      fontSize: 9,
      fontWeight:
        '700',
    },
    list: {
      padding: 14,
      paddingBottom:
        110,
      gap: 8,
    },
    card: {
      minHeight: 88,
      padding: 11,
      borderWidth: 1,
      borderRadius: 20,
      alignItems:
        'center',
      gap: 10,
    },
    cardIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor:
        '#FFF8E7',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    cardTitle: {
      fontSize: 12,
      fontWeight:
        '900',
    },
    cardSubtitle: {
      marginTop: 3,
      fontSize: 9,
      lineHeight: 14,
      fontWeight:
        '600',
    },
    statusBadge: {
      alignSelf:
        'flex-start',
      minHeight: 23,
      marginTop: 5,
      paddingHorizontal:
        8,
      borderRadius: 8,
      backgroundColor:
        '#ECFDF3',
      justifyContent:
        'center',
    },
    statusText: {
      color:
        '#10A66A',
      fontSize: 7,
      fontWeight:
        '900',
    },
    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingBottom:
        100,
    },
    empty: {
      alignItems:
        'center',
      paddingHorizontal:
        25,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 23,
      backgroundColor:
        '#F2F4F7',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    emptyTitle: {
      marginTop: 12,
      fontSize: 14,
      fontWeight:
        '900',
      textAlign:
        'center',
    },
  });
