import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

function parseIso(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
};

export default function AdminDateField({
  label,
  value,
  onChange,
  required,
  minDate,
  maxDate,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const selected = parseIso(value);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const leading = first.getDay();

    const items: Array<Date | null> = [];

    for (let index = 0; index < leading; index += 1) {
      items.push(null);
    }

    for (let day = 1; day <= lastDay; day += 1) {
      items.push(new Date(year, month, day));
    }

    while (items.length % 7 !== 0) {
      items.push(null);
    }

    return items;
  }, [cursor]);

  const monthTitle = cursor.toLocaleDateString(
    isRTL ? 'ar-JO' : 'en-US',
    {
      month: 'long',
      year: 'numeric',
    }
  );

  const week = isRTL
    ? ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const allowed = (date: Date) => {
    const iso = toIso(date);

    if (minDate && iso < minDate) return false;
    if (maxDate && iso > maxDate) return false;

    return true;
  };

  return (
    <View style={styles.group}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textSecondary,
            textAlign,
          },
        ]}
      >
        {label}
        {required ? ' *' : ''}
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            flexDirection: direction,
            backgroundColor: theme.colors.surface2,
            borderColor: calendarOpen ? '#F7B83A' : theme.colors.border,
          },
        ]}
      >
        <Ionicons name="calendar-outline" size={19} color="#F7B83A" />

        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#8191A0"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              textAlign,
            },
          ]}
        />

        {!!value && (
          <Pressable hitSlop={8} onPress={() => onChange('')}>
            <Ionicons name="close-circle" size={18} color="#8191A0" />
          </Pressable>
        )}

        <Pressable
          hitSlop={8}
          onPress={() => {
            setCursor(selected ?? new Date());
            setCalendarOpen((current) => !current);
          }}
          style={[
            styles.calendarButton,
            calendarOpen && styles.calendarButtonOpen,
          ]}
        >
          <Ionicons
            name={calendarOpen ? 'chevron-up' : 'calendar'}
            size={19}
            color="#0A2D44"
          />
        </Pressable>
      </View>

      {calendarOpen && (
        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.monthHeader,
              {
                flexDirection: direction,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setCursor(
                  new Date(
                    cursor.getFullYear(),
                    cursor.getMonth() - 1,
                    1
                  )
                )
              }
              style={[
                styles.nav,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={19}
                color={theme.colors.text}
              />
            </Pressable>

            <Text
              style={[
                styles.monthTitle,
                {
                  color: theme.colors.text,
                },
              ]}
            >
              {monthTitle}
            </Text>

            <Pressable
              onPress={() =>
                setCursor(
                  new Date(
                    cursor.getFullYear(),
                    cursor.getMonth() + 1,
                    1
                  )
                )
              }
              style={[
                styles.nav,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={19}
                color={theme.colors.text}
              />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {week.map((item) => (
              <Text
                key={item}
                style={[
                  styles.weekText,
                  {
                    color: theme.colors.textSecondary,
                  },
                ]}
              >
                {item}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const iso = toIso(date);
              const active = iso === value;
              const today = iso === toIso(new Date());
              const enabled = allowed(date);

              return (
                <Pressable
                  key={iso}
                  disabled={!enabled}
                  onPress={() => {
                    onChange(iso);
                    setCalendarOpen(false);
                  }}
                  style={[
                    styles.dayCell,
                    active && styles.selectedCell,
                    !active &&
                      today && {
                        borderColor: '#F7B83A',
                        borderWidth: 1,
                      },
                    !enabled && { opacity: 0.28 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: active ? '#0A2D44' : theme.colors.text,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.calendarFooter,
              {
                flexDirection: direction,
              },
            ]}
          >
            <Pressable
              onPress={() => {
                onChange(toIso(new Date()));
                setCalendarOpen(false);
              }}
              style={[
                styles.footerButton,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.footerButtonText,
                  {
                    color: theme.colors.text,
                  },
                ]}
              >
                {isRTL ? 'اليوم' : 'Today'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onChange('');
                setCalendarOpen(false);
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>
                {isRTL ? 'مسح التاريخ' : 'Clear'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text
        style={[
          styles.helper,
          {
            color: theme.colors.textSecondary,
            textAlign,
          },
        ]}
      >
        {isRTL
          ? 'اكتب التاريخ أو افتح التقويم.'
          : 'Type the date or open the calendar.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 12,
  },
  label: {
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '800',
  },
  inputWrap: {
    minHeight: 53,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 51,
    fontSize: 12,
    fontWeight: '700',
  },
  calendarButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarButtonOpen: {
    transform: [{ scale: 0.98 }],
  },
  calendarCard: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 11,
  },
  monthHeader: {
    alignItems: 'center',
  },
  nav: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
  },
  weekRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  weekText: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 7.5,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCell: {
    backgroundColor: '#F7B83A',
  },
  dayText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  calendarFooter: {
    marginTop: 8,
    gap: 7,
  },
  footerButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  clearButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 12,
    backgroundColor: 'rgba(217,74,74,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: '#D94A4A',
    fontSize: 8.5,
    fontWeight: '900',
  },
  helper: {
    marginTop: 5,
    fontSize: 7.5,
    fontWeight: '600',
  },
});
