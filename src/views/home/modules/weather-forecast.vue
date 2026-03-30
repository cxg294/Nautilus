<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { $t } from '@/locales';

defineOptions({ name: 'WeatherForecast' });

// === 默认城市：北京 ===
const LATITUDE = 39.9042;
const LONGITUDE = 116.4074;

// === 数据状态 ===
interface DailyForecast {
  date: string;
  weekday: number; // 0=Sun, 1=Mon, ... 6=Sat
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  windSpeed: number;
  windDirection: number;
}

const forecasts = ref<DailyForecast[]>([]);
const loading = ref(true);
const hasError = ref(false);

// === WMO 天气码 → 中文描述 ===
function getWeatherDesc(code: number): string {
  const map: Record<number, string> = {
    0: '晴',
    1: '晴间多云',
    2: '多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '密毛毛雨',
    56: '冻毛毛雨',
    57: '冻雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '大冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '阵雨',
    81: '中阵雨',
    82: '大阵雨',
    85: '小阵雪',
    86: '大阵雪',
    95: '雷阵雨',
    96: '雷阵雨伴冰雹',
    99: '大雷雨伴冰雹'
  };
  return map[code] ?? '未知';
}

// === WMO 天气码 → Emoji ===
function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ([51, 53, 61, 80].includes(code)) return '🌦️';
  if ([55, 56, 57, 63, 65, 66, 67, 81].includes(code)) return '🌧️';
  if (code === 82) return '⛈️';
  if ([71, 85].includes(code)) return '🌨️';
  if ([73, 75, 77, 86].includes(code)) return '❄️';
  if (code === 95) return '🌩️';
  if (code === 96 || code === 99) return '⛈️';
  return '🌤️';
}

// === 风向角度 → 中文方位 ===
function getWindDirection(degrees: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index = Math.round(degrees / 45) % 8;
  return dirs[index];
}

// === 风速 (km/h) → 风力等级 ===
function getWindLevel(speedKmh: number): string {
  if (speedKmh < 2) return '0';
  if (speedKmh < 6) return '1';
  if (speedKmh < 12) return '2';
  if (speedKmh < 20) return '3';
  if (speedKmh < 29) return '4';
  if (speedKmh < 39) return '5';
  if (speedKmh < 50) return '6';
  if (speedKmh < 62) return '7';
  return '8+';
}

// === 特殊天气检测（需要提醒的天气码）===
const severeWeatherCodes = new Set([63, 65, 66, 67, 75, 82, 86, 95, 96, 99]);

// === 星期标签 ===
const weekdayKeyMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function getWeekdayLabel(weekday: number, index: number): string {
  if (index === 0) return $t('page.home.weather.today');
  if (index === 1) return $t('page.home.weather.tomorrow');
  const key = weekdayKeyMap[weekday];
  return key ? $t(`page.home.weather.weekdays.${key}`) : '';
}

// === 今日是否有特殊天气 ===
const todaySevereDesc = computed(() => {
  const today = forecasts.value[0];
  if (!today) return null;
  if (severeWeatherCodes.has(today.weatherCode)) {
    return getWeatherDesc(today.weatherCode);
  }
  return null;
});

// === 天气提示文案（根据今日天气码生成）===
function getWeatherTip(code: number, tempMax: number, tempMin: number): string {
  // 极端天气提示
  if ([95, 96, 99].includes(code)) return '⚡ 雷暴天气，请尽量待在室内，远离空旷地带';
  if ([65, 67, 82].includes(code)) return '🌊 雨势较大，出门请带好雨具，注意路面积水';
  if ([63, 81].includes(code)) return '🌂 今天有中雨，出门别忘了带伞';
  if ([75, 86].includes(code)) return '⛷️ 大雪天气，注意保暖和出行安全';
  if ([71, 73, 77, 85].includes(code)) return '❄️ 有雪花飘落，路面可能湿滑，小心慢行';
  if ([45, 48].includes(code)) return '🌁 雾气较重，开车请注意降速，保持车距';
  // 普通天气提示
  if ([51, 53, 55, 56, 57, 61, 66, 80].includes(code)) return '☂️ 有小雨，建议随身带把伞以防万一';
  if (code === 3) return '☁️ 阴天适合室内活动，别忘了起身走动一下';
  if (code === 2) return '🌥️ 多云天气，体感舒适，适合外出';
  // 好天气提示
  if (tempMax >= 35) return '🥵 高温天气，注意防暑降温，多喝水';
  if (tempMin <= 0) return '🧣 气温较低，注意添衣保暖';
  if (tempMax - tempMin >= 12) return '🧥 今天昼夜温差较大，注意适时增减衣物';
  if ([0, 1].includes(code)) return '☀️ 天气晴好，适合出门走走，享受阳光吧';
  return '🌈 今天天气还不错，祝你有美好的一天';
}

const weatherTip = computed(() => {
  const today = forecasts.value[0];
  if (!today) return '';
  return getWeatherTip(today.weatherCode, today.tempMax, today.tempMin);
});

// === 获取真实天气数据 ===
onMounted(async () => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&timezone=Asia%2FShanghai&forecast_days=4`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const daily = data.daily;
    forecasts.value = daily.time.map((dateStr: string, i: number) => {
      const d = new Date(dateStr + 'T00:00:00');
      return {
        date: dateStr,
        weekday: d.getDay(),
        weatherCode: daily.weather_code[i],
        tempMax: Math.round(daily.temperature_2m_max[i]),
        tempMin: Math.round(daily.temperature_2m_min[i]),
        windSpeed: daily.wind_speed_10m_max[i],
        windDirection: daily.wind_direction_10m_dominant[i]
      };
    });
  } catch {
    hasError.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <NCard :title="$t('page.home.weather.title')" :bordered="false" size="small" segmented class="card-wrapper">
    <!-- 加载中 -->
    <div v-if="loading" class="weather-loading">
      <NSpin size="small" />
    </div>

    <!-- 加载失败 -->
    <NAlert v-else-if="hasError" type="error" :show-icon="true">
      天气数据加载失败，请检查网络连接
    </NAlert>

    <!-- 天气内容 -->
    <template v-else>
      <!-- 特殊天气提醒 -->
      <NAlert v-if="todaySevereDesc" type="warning" class="mb-12px" :show-icon="true">
        {{ $t('page.home.weather.alertMsg', { weather: todaySevereDesc }) }}
      </NAlert>

      <!-- 4日天气卡片 -->
      <div class="weather-grid">
        <div
          v-for="(cast, index) in forecasts"
          :key="cast.date"
          class="weather-day"
          :class="{ 'weather-day--today': index === 0 }"
        >
          <div class="weather-day__label">{{ getWeekdayLabel(cast.weekday, index) }}</div>
          <div class="weather-day__emoji">{{ getWeatherEmoji(cast.weatherCode) }}</div>
          <div class="weather-day__desc">{{ getWeatherDesc(cast.weatherCode) }}</div>
          <div class="weather-day__temp">
            <span class="temp-low">{{ cast.tempMin }}°</span>
            <span class="temp-sep">~</span>
            <span class="temp-high">{{ cast.tempMax }}°</span>
          </div>
          <div class="weather-day__wind">{{ getWindDirection(cast.windDirection) }}风 {{ getWindLevel(cast.windSpeed) }}级</div>
        </div>
      </div>

      <!-- 天气提示文案 -->
      <div v-if="weatherTip" class="weather-tip">
        {{ weatherTip }}
      </div>
    </template>
  </NCard>
</template>

<style scoped>
.weather-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 160px;
}

.weather-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.weather-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  border-radius: 12px;
  background: rgba(var(--primary-color-rgb, 64, 158, 255), 0.04);
  transition: all 0.25s ease;
  cursor: default;
}

.weather-day:hover {
  background: rgba(var(--primary-color-rgb, 64, 158, 255), 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.weather-day--today {
  background: rgba(var(--primary-color-rgb, 64, 158, 255), 0.1);
  border: 1px solid rgba(var(--primary-color-rgb, 64, 158, 255), 0.2);
}

.weather-day__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-1, #333);
}

.weather-day__emoji {
  font-size: 36px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.weather-day__desc {
  font-size: 13px;
  color: var(--text-color-2, #666);
}

.weather-day__temp {
  font-size: 14px;
  font-weight: 500;
}

.temp-low {
  color: #3b82f6;
}

.temp-sep {
  color: #999;
  margin: 0 2px;
}

.temp-high {
  color: #f97316;
}

.weather-day__wind {
  font-size: 12px;
  color: var(--text-color-3, #999);
}

.weather-tip {
  margin-top: 16px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-color-2, #666);
  background: rgba(var(--primary-color-rgb, 64, 158, 255), 0.04);
  border-radius: 8px;
  line-height: 1.6;
  text-align: center;
}

@media (max-width: 640px) {
  .weather-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
