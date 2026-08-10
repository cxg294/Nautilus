<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { DataTableColumns } from 'naive-ui';
import { fetchMidPriceCourseDashboard, refreshMidPriceCourseDashboard, type MidPriceDashboard } from '@/service/api/mid-price-course';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('mid-price-course');
const loading = ref(false);
const refreshing = ref(false);
const selectedTerms = ref(['暑假04期', '暑假05期', '暑假06期']);
const selectedCourseTypes = ref(['L1软编', 'AI通识', '硬件']);
const gradeSelectedTerms = ref(['暑假04期', '暑假05期', '暑假06期']);
const gradeSelectedCourseTypes = ref(['L1软编', 'AI通识', '硬件']);
const gradeSubjectDisplay = ref<'all' | '图形化' | 'Python'>('all');
const gradeComparisonMode = ref<'by-grade' | 'by-term'>('by-grade');
const gradeComparisonTerm = ref('暑假04期');
const gradeComparisonGrade = ref('一年级');
const activeTab = ref<'overview' | 'grades'>('overview');
const dashboard = ref<MidPriceDashboard | null>(null);
const graphicAttendRef = ref<HTMLElement | null>(null);
const graphicCompletionRef = ref<HTMLElement | null>(null);
const graphicT7AttendRef = ref<HTMLElement | null>(null);
const graphicT7CompletionRef = ref<HTMLElement | null>(null);
const pythonAttendRef = ref<HTMLElement | null>(null);
const pythonCompletionRef = ref<HTMLElement | null>(null);
const pythonT7AttendRef = ref<HTMLElement | null>(null);
const pythonT7CompletionRef = ref<HTMLElement | null>(null);
const volumeRef = ref<HTMLElement | null>(null);
const graphicLiveAttendanceRef = ref<HTMLElement | null>(null);
const pythonLiveAttendanceRef = ref<HTMLElement | null>(null);
const graphicDurationRef = ref<HTMLElement | null>(null);
const pythonDurationRef = ref<HTMLElement | null>(null);
const graphicGradeAttendRef = ref<HTMLElement | null>(null);
const graphicGradeCompletionRef = ref<HTMLElement | null>(null);
const graphicGradeT7AttendRef = ref<HTMLElement | null>(null);
const graphicGradeT7CompletionRef = ref<HTMLElement | null>(null);
const graphicGradeDurationRef = ref<HTMLElement | null>(null);
const pythonGradeAttendRef = ref<HTMLElement | null>(null);
const pythonGradeCompletionRef = ref<HTMLElement | null>(null);
const pythonGradeT7AttendRef = ref<HTMLElement | null>(null);
const pythonGradeT7CompletionRef = ref<HTMLElement | null>(null);
const pythonGradeDurationRef = ref<HTMLElement | null>(null);
const graphicGradeMixRef = ref<HTMLElement | null>(null);
const pythonGradeMixRef = ref<HTMLElement | null>(null);
let charts: echarts.ECharts[] = [];

const termOptions = computed(() => [...new Set((dashboard.value?.tracks || []).map(item => item.name))].map(value => ({ label: value, value })));
const courseTypeOptions = ['L1软编', 'AI通识', '硬件'].map(value => ({ label: value, value }));
const GRADE_ORDER = ['幼儿中班', '幼儿大班', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const gradeVisibleSubjects = computed(() => gradeSubjectDisplay.value === 'all' ? ['图形化', 'Python'] : [gradeSubjectDisplay.value]);
const selectedSeries = computed(() => (dashboard.value?.series || []).filter(item => selectedTerms.value.includes(item.termName)));
const filteredGradeRows = computed(() => (dashboard.value?.gradeRows || []).filter(row => gradeSelectedTerms.value.includes(row.termName) && gradeSelectedCourseTypes.value.includes(courseCategory(row.lesson)) && gradeVisibleSubjects.value.includes(row.subject)));
const updatedAt = computed(() => dashboard.value?.source.sourceLastUpdateTime || dashboard.value?.cache.updatedAt || '');
const gradeMixWidth = computed(() => Math.max(900, gradeSelectedTerms.value.length * 190));
const unlockProgress = computed(() => selectedTerms.value.map(termName => ({
  termName,
  tracks: (dashboard.value?.series || []).filter(item => item.termName === termName).map(item => {
    const unlockedLessons = item.lessons.filter(lesson => lesson.unlocked > 0);
    const current = [...unlockedLessons].sort((a, b) => b.rank - a.rank)[0];
    return { subject: item.subject, lessonCount: unlockedLessons.length, currentLesson: current ? courseLabel(current.lesson) : '暂未解锁' };
  }),
})));
interface DetailRow { subject: string; courseType: string; termName: string; lesson: string; rank: number; unlocked: number; durationMedianMs: number | null; liveAttendees: number | null; liveAttendRate: number | null; attend: number; complete: number; t7Attend: number; t7Complete: number; attendRate: number | null; completionRate: number | null; t7AttendRate: number | null; t7CompletionRate: number | null }
interface LiveAttendanceRow { subject: '图形化' | 'Python'; termName: string; lesson: string; liveName: string; startedAt: string; attendees: number; unlocked: number; rate: number | null }
const liveAttendanceRows = computed<LiveAttendanceRow[]>(() => (dashboard.value?.liveAttendance || [])
  .filter(item => selectedTerms.value.includes(item.termName) && selectedCourseTypes.value.includes(courseCategory(item.lesson)))
  .map(item => {
    const lesson = (dashboard.value?.series || []).find(series => series.termId === item.termId)?.lessons.find(row => row.lesson === item.lesson);
    return { ...item, unlocked: lesson?.unlocked || 0, rate: lesson?.unlocked ? item.attendees / lesson.unlocked : null };
  }));
const detailRows = computed<DetailRow[]>(() => {
  const termOrder = new Map((dashboard.value?.tracks || []).map((track, index) => [track.name, index]));
  return selectedSeries.value
    .flatMap(item => item.lessons.filter(lesson => selectedCourseTypes.value.includes(courseCategory(lesson.lesson))).map(lesson => {
      const live = liveAttendanceRows.value.find(row => row.subject === item.subject && row.termName === item.termName && row.lesson === lesson.lesson);
      return { ...lesson, subject: item.subject, courseType: courseCategory(lesson.lesson), termName: item.termName, lesson: courseLabel(lesson.lesson), liveAttendees: live?.attendees ?? null, liveAttendRate: live?.rate ?? null };
    }))
    .sort((a, b) => (termOrder.get(a.termName)! - termOrder.get(b.termName)!) || a.subject.localeCompare(b.subject, 'zh-CN') || a.rank - b.rank);
});
const detailColumns: DataTableColumns<DetailRow> = [
  { title: '期次', key: 'termName', width: 100, fixed: 'left', sorter: 'default' }, { title: '学科', key: 'subject', width: 92, fixed: 'left', sorter: 'default' }, { title: '课程分类', key: 'courseType', width: 100, sorter: 'default' }, { title: '课程', key: 'lesson', minWidth: 150, sorter: (a, b) => a.rank - b.rank },
  { title: '解锁人数', key: 'unlocked', width: 96, align: 'right', sorter: (a, b) => a.unlocked - b.unlocked }, { title: '完课时长中位数', key: 'durationMedianMs', width: 132, align: 'right', sorter: (a, b) => (a.durationMedianMs || 0) - (b.durationMedianMs || 0), render: row => minutes(row.durationMedianMs) }, { title: '直播到播人数', key: 'liveAttendees', width: 116, align: 'right', sorter: (a: any, b: any) => (a.liveAttendees || 0) - (b.liveAttendees || 0), render: (row: any) => row.liveAttendees ?? '-' }, { title: '直播到播率', key: 'liveAttendRate', width: 108, align: 'right', sorter: (a: any, b: any) => (a.liveAttendRate || 0) - (b.liveAttendRate || 0), render: (row: any) => percent(row.liveAttendRate) }, { title: 'T0 到课人数', key: 'attend', width: 108, align: 'right', sorter: (a, b) => a.attend - b.attend }, { title: 'T0 完课人数', key: 'complete', width: 108, align: 'right', sorter: (a, b) => a.complete - b.complete },
  { title: 'T0 到课率', key: 'attendRate', width: 100, align: 'right', sorter: (a, b) => (a.attendRate || 0) - (b.attendRate || 0), render: row => percent(row.attendRate) }, { title: 'T0 到完比', key: 'completionRate', width: 100, align: 'right', sorter: (a, b) => (a.completionRate || 0) - (b.completionRate || 0), render: row => percent(row.completionRate) },
  { title: 'T7 到课人数', key: 't7Attend', width: 108, align: 'right', sorter: (a, b) => a.t7Attend - b.t7Attend }, { title: 'T7 完课人数', key: 't7Complete', width: 108, align: 'right', sorter: (a, b) => a.t7Complete - b.t7Complete },
  { title: 'T7 到课率', key: 't7AttendRate', width: 100, align: 'right', sorter: (a, b) => (a.t7AttendRate || 0) - (b.t7AttendRate || 0), render: row => percent(row.t7AttendRate) }, { title: 'T7 到完比', key: 't7CompletionRate', width: 100, align: 'right', sorter: (a, b) => (a.t7CompletionRate || 0) - (b.t7CompletionRate || 0), render: row => percent(row.t7CompletionRate) },
];
const gradeColumns: DataTableColumns<any> = [
  { title: '期次', key: 'termName', width: 100, fixed: 'left', sorter: 'default' }, { title: '学科', key: 'subject', width: 92, fixed: 'left', sorter: 'default' }, { title: '课程', key: 'lesson', width: 150, render: row => courseLabel(row.lesson) }, { title: '年级', key: 'grade', width: 100, sorter: 'default' },
  { title: '解锁人数', key: 'unlocked', width: 96, align: 'right', sorter: (a, b) => a.unlocked - b.unlocked }, { title: '完课时长中位数', key: 'durationMedianMs', width: 132, align: 'right', sorter: (a, b) => (a.durationMedianMs || 0) - (b.durationMedianMs || 0), render: row => minutes(row.durationMedianMs) }, { title: 'T0 到课率', key: 'attendRate', width: 104, align: 'right', sorter: (a, b) => (a.attendRate || 0) - (b.attendRate || 0), render: row => percent(row.attendRate) }, { title: 'T0 到完比', key: 'completionRate', width: 104, align: 'right', sorter: (a, b) => (a.completionRate || 0) - (b.completionRate || 0), render: row => percent(row.completionRate) }, { title: 'T7 到课率', key: 't7AttendRate', width: 104, align: 'right', sorter: (a, b) => (a.t7AttendRate || 0) - (b.t7AttendRate || 0), render: row => percent(row.t7AttendRate) }, { title: 'T7 到完比', key: 't7CompletionRate', width: 104, align: 'right', sorter: (a, b) => (a.t7CompletionRate || 0) - (b.t7CompletionRate || 0), render: row => percent(row.t7CompletionRate) },
];

function percent(value: number | null | undefined) { return value == null ? '-' : `${(value * 100).toFixed(1)}%`; }
function minutes(value: number | null | undefined) { return value == null ? '-' : `${(value / 60000).toFixed(1)} 分`; }
function courseLabel(sequence: string) {
  const [stageText, lessonText] = sequence.split('_');
  const stage = Number(stageText);
  const lesson = Number(lessonText);
  // 真实课序：01-01、01-02、02-01、02-02 是第 1–4 课；其后才进入搭建/硬件/AI 循环。
  const ordinal = stage === 1 ? lesson : 2 + (stage - 2) * 3 + lesson;
  if (ordinal <= 4) return `${sequence.replace('_', '-')} · ${ordinal}课`;
  const names = ['搭建', '硬件', 'AI'];
  const index = ordinal - 5;
  return `${sequence.replace('_', '-')} · ${names[index % 3] || '课程'}${Math.floor(index / 3) + 1}`;
}
function courseCategory(sequence: string) {
  const [stageText, lessonText] = sequence.split('_');
  const stage = Number(stageText);
  const lesson = Number(lessonText);
  const ordinal = stage === 1 ? lesson : 2 + (stage - 2) * 3 + lesson;
  if (ordinal <= 4) return 'L1软编';
  return (ordinal - 5) % 3 === 2 ? 'AI通识' : '硬件';
}
function courseChartOption(metric: 'attendRate' | 'completionRate' | 't7AttendRate' | 't7CompletionRate', title: string, subject: '图形化' | 'Python') {
  const series = selectedSeries.value.filter(item => item.subject === subject).map(item => ({ ...item, lessons: item.lessons.filter(lesson => selectedCourseTypes.value.includes(courseCategory(lesson.lesson))) }));
  const labels = [...new Set(series.flatMap(item => item.lessons.map(lesson => lesson.lesson)))].sort();
  const values = series.flatMap(item => item.lessons.map(lesson => lesson[metric]).filter((value): value is number => value !== null));
  const minValue = values.length ? Math.max(0, Math.floor(Math.min(...values) * 10) / 10 - 0.1) : 0;
  return {
    title: { text: title, textStyle: { fontSize: 15, fontWeight: 600 } },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => percent(value) },
    legend: { top: 30 }, grid: { left: 50, right: 28, top: 72, bottom: 38 },
    xAxis: { type: 'category', data: labels.map(courseLabel), name: '课程', axisLabel: { interval: 0, rotate: 28 } },
    yAxis: { type: 'value', name: '比例', min: minValue, max: 1, axisLabel: { formatter: (value: number) => percent(value) } },
    series: series.map(item => ({ name: item.termName, type: 'line', smooth: false, connectNulls: false, data: labels.map(label => item.lessons.find(lesson => lesson.lesson === label)?.[metric] ?? null) })),
  };
}
function volumeChartOption() {
  const terms = selectedTerms.value;
  const valueFor = (targetSubject: '图形化' | 'Python', termName: string) => {
    const lessons = (dashboard.value?.series || []).find(item => item.subject === targetSubject && item.termName === termName)?.lessons || [];
    return Math.max(0, ...lessons.map(lesson => lesson.unlocked));
  };
  return { title: { text: '进量对比：各期次解锁人数', textStyle: { fontSize: 15, fontWeight: 600 } }, tooltip: { trigger: 'axis' }, legend: { top: 30 }, grid: { left: 55, right: 28, top: 72, bottom: 38 }, xAxis: { type: 'category', data: terms, name: '期次' }, yAxis: { type: 'value', name: '解锁人数', minInterval: 1 }, series: (['图形化', 'Python'] as const).map(name => ({ name, type: 'bar', barMaxWidth: 42, label: { show: true, position: 'top', formatter: '{c}' }, data: terms.map(term => valueFor(name, term)) })) };
}
function liveAttendanceChartOption(subject: '图形化' | 'Python') {
  const rows = liveAttendanceRows.value.filter(row => row.subject === subject);
  const terms = selectedTerms.value.filter(term => rows.some(row => row.termName === term));
  const lessons = [...new Set(rows.map(row => row.lesson))].sort((a, b) => lessonRank(a) - lessonRank(b));
  const values = rows.map(row => row.rate).filter((value): value is number => value !== null);
  const min = values.length ? Math.max(0, Math.floor(Math.min(...values) * 10) / 10 - 0.1) : 0;
  return {
    title: { text: `${subject} · 直播到播率`, subtext: '到播人数 ÷ 解锁人数', left: 'center', top: 6, textStyle: { fontSize: 15, fontWeight: 600 }, subtextStyle: { fontSize: 12 } },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => percent(value) }, legend: { top: 54 }, grid: { left: 52, right: 28, top: 112, bottom: 52 },
    xAxis: { type: 'category', data: lessons.map(courseLabel), name: '课程', axisLabel: { interval: 0, rotate: 28 } },
    yAxis: { type: 'value', min, max: 1, name: '到播率', axisLabel: { formatter: (value: number) => percent(value) } },
    series: terms.map(term => ({ name: term, type: 'line', smooth: false, connectNulls: false, data: lessons.map(lesson => rows.find(row => row.termName === term && row.lesson === lesson)?.rate ?? null) })),
  };
}
function durationChartOption(subject: '图形化' | 'Python') {
  const series = selectedSeries.value
    .filter(item => item.subject === subject)
    .map(item => ({ ...item, lessons: item.lessons.filter(lesson => selectedCourseTypes.value.includes(courseCategory(lesson.lesson))) }));
  const lessons = [...new Set(series.flatMap(item => item.lessons.map(lesson => lesson.lesson)))].sort((a, b) => lessonRank(a) - lessonRank(b));
  const values = series.flatMap(item => item.lessons.map(lesson => lesson.durationMedianMs).filter((value): value is number => value !== null).map(value => value / 60000));
  const min = values.length ? Math.max(0, Math.floor(Math.min(...values) / 5) * 5 - 5) : 0;
  const max = values.length ? Math.ceil(Math.max(...values) / 5) * 5 + 5 : 60;
  return {
    title: { text: `${subject} · 完课时长中位数`, subtext: '各年级按完课人数加权 · 分钟', left: 'center', top: 6, textStyle: { fontSize: 15, fontWeight: 600 }, subtextStyle: { fontSize: 12 } },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value.toFixed(1)} 分` }, legend: { top: 54 }, grid: { left: 52, right: 28, top: 112, bottom: 52 },
    xAxis: { type: 'category', data: lessons.map(courseLabel), name: '课程', axisLabel: { interval: 0, rotate: 28 } },
    yAxis: { type: 'value', min, max, name: '分钟', axisLabel: { formatter: (value: number) => `${value} 分` } },
    series: series.map(item => ({ name: item.termName, type: 'line', smooth: false, connectNulls: false, data: lessons.map(lesson => { const value = item.lessons.find(row => row.lesson === lesson)?.durationMedianMs; return value == null ? null : value / 60000; }) })),
  };
}
function gradeCourseChartOption(metric: 'attendRate' | 'completionRate' | 't7AttendRate' | 't7CompletionRate' | 'durationMedianMs', title: string, subject: '图形化' | 'Python') {
  const rows = filteredGradeRows.value.filter(row => row.subject === subject && (gradeComparisonMode.value === 'by-grade' ? row.termName === gradeComparisonTerm.value : row.grade === gradeComparisonGrade.value));
  const lessons = [...new Set(rows.map(row => row.lesson))].sort((a, b) => lessonRank(a) - lessonRank(b));
  const groups = gradeComparisonMode.value === 'by-grade' ? GRADE_ORDER.filter(grade => rows.some(row => row.grade === grade)) : gradeSelectedTerms.value.filter(term => rows.some(row => row.termName === term));
  const isDuration = metric === 'durationMedianMs';
  const values = rows.map(row => isDuration ? row.durationMedianMs == null ? null : row.durationMedianMs / 60000 : row[metric]).filter((value): value is number => value !== null);
  const min = values.length ? (isDuration ? Math.max(0, Math.floor(Math.min(...values) / 5) * 5 - 5) : Math.max(0, Math.floor(Math.min(...values) * 10) / 10 - 0.1)) : 0;
  const max = isDuration ? (values.length ? Math.ceil(Math.max(...values) / 5) * 5 + 5 : 60) : 1;
  const isByGrade = gradeComparisonMode.value === 'by-grade';
  const isAttend = metric === 'attendRate' || metric === 't7AttendRate';
  const isT7 = metric === 't7AttendRate' || metric === 't7CompletionRate';
  return { title: { text: title, textStyle: { fontSize: 15, fontWeight: 600 } }, tooltip: { trigger: 'axis', valueFormatter: (value: number) => isDuration ? `${value.toFixed(1)} 分` : percent(value) }, legend: { top: 30 }, grid: { left: 52, right: 28, top: 72, bottom: 52 }, xAxis: { type: 'category', data: lessons.map(courseLabel), name: '课程', axisLabel: { interval: 0, rotate: 28 } }, yAxis: { type: 'value', min, max, name: isDuration ? '分钟' : '比例', axisLabel: { formatter: (value: number) => isDuration ? `${value} 分` : percent(value) } }, series: groups.map(name => ({ name, type: 'line', smooth: false, data: lessons.map(lesson => { const matched = rows.filter(row => row.lesson === lesson && (isByGrade ? row.grade === name : row.termName === name)); if (isDuration) { const value = matched[0]?.durationMedianMs; return value == null ? null : value / 60000; } const unlocked = matched.reduce((sum, row) => sum + row.unlocked, 0); const attend = matched.reduce((sum, row) => sum + (isT7 ? row.t7Attend : row.attend), 0); const complete = matched.reduce((sum, row) => sum + (isT7 ? row.t7Complete : row.complete), 0); return (isAttend ? unlocked : attend) ? (isAttend ? attend : complete) / (isAttend ? unlocked : attend) : null; }) })) };
}
function gradeMixChartOption(subject: '图形化' | 'Python') {
  const rows = filteredGradeRows.value.filter(row => row.subject === subject);
  const groups = [...new Set(rows.map(row => `${row.termName} · ${row.subject}`))];
  const grades = GRADE_ORDER.filter(grade => rows.some(row => row.grade === grade));
  // 年级结构是同一批学生的画像：各年级先取已解锁课序的最大人数，再汇总，不能把多节课重复相加。
  const gradeUnlockedFor = (group: string, grade: string) => Math.max(0, ...rows.filter(item => `${item.termName} · ${item.subject}` === group && item.grade === grade).map(item => item.unlocked));
  const totalFor = (group: string) => grades.reduce((sum, grade) => sum + gradeUnlockedFor(group, grade), 0);
  return { title: { text: '年级结构占比（按解锁人数）', textStyle: { fontSize: 15, fontWeight: 600 } }, tooltip: { trigger: 'axis', valueFormatter: (value: number) => percent(value) }, legend: { top: 30 }, grid: { left: 56, right: 28, top: 72, bottom: 48 }, xAxis: { type: 'category', data: groups, axisLabel: { interval: 0, rotate: 18 } }, yAxis: { type: 'value', min: 0, max: 1, axisLabel: { formatter: (value: number) => percent(value) } }, series: grades.map(grade => ({ name: grade, type: 'bar', stack: 'total', barWidth: 72, label: { show: true, position: 'inside', color: '#fff', fontSize: 11, formatter: (params: any) => params.data.unlocked ? `${params.data.unlocked}\n${percent(params.value)}` : '' }, data: groups.map(group => { const gradeUnlocked = gradeUnlockedFor(group, grade); const total = totalFor(group); return { value: total ? gradeUnlocked / total : 0, unlocked: gradeUnlocked }; }) })) };
}
function renderCharts() {
  charts.forEach(chart => chart.dispose()); charts = [];
  const configs: Array<[HTMLElement | null, 'attendRate' | 'completionRate' | 't7AttendRate' | 't7CompletionRate', string, '图形化' | 'Python']> = [
    [graphicAttendRef.value, 'attendRate', '到课率（T0）', '图形化'], [graphicCompletionRef.value, 'completionRate', '到完比（T0）', '图形化'],
    [graphicT7AttendRef.value, 't7AttendRate', '到课率（T7）', '图形化'], [graphicT7CompletionRef.value, 't7CompletionRate', '到完比（T7）', '图形化'],
    [pythonAttendRef.value, 'attendRate', '到课率（T0）', 'Python'], [pythonCompletionRef.value, 'completionRate', '到完比（T0）', 'Python'],
    [pythonT7AttendRef.value, 't7AttendRate', '到课率（T7）', 'Python'], [pythonT7CompletionRef.value, 't7CompletionRate', '到完比（T7）', 'Python'],
  ];
  configs.forEach(([element, metric, title, currentSubject]) => { if (element) { const chart = echarts.init(element); chart.setOption(courseChartOption(metric, title, currentSubject)); charts.push(chart); } });
  if (volumeRef.value) { const chart = echarts.init(volumeRef.value); chart.setOption(volumeChartOption()); charts.push(chart); }
  ([['图形化', graphicLiveAttendanceRef.value], ['Python', pythonLiveAttendanceRef.value]] as const).forEach(([subject, element]) => { if (element) { const chart = echarts.init(element); chart.setOption(liveAttendanceChartOption(subject)); charts.push(chart); } });
  ([['图形化', graphicDurationRef.value], ['Python', pythonDurationRef.value]] as const).forEach(([subject, element]) => { if (element) { const chart = echarts.init(element); chart.setOption(durationChartOption(subject)); charts.push(chart); } });
  const gradeConfigs: Array<[HTMLElement | null, 'attendRate' | 'completionRate' | 't7AttendRate' | 't7CompletionRate' | 'durationMedianMs', string, '图形化' | 'Python']> = [
    [graphicGradeAttendRef.value, 'attendRate', '图形化 · T0 到课率', '图形化'], [graphicGradeCompletionRef.value, 'completionRate', '图形化 · T0 到完比', '图形化'],
    [graphicGradeT7AttendRef.value, 't7AttendRate', '图形化 · T7 到课率', '图形化'], [graphicGradeT7CompletionRef.value, 't7CompletionRate', '图形化 · T7 到完比', '图形化'],
    [graphicGradeDurationRef.value, 'durationMedianMs', '图形化 · 完课时长中位数', '图形化'],
    [pythonGradeAttendRef.value, 'attendRate', 'Python · T0 到课率', 'Python'], [pythonGradeCompletionRef.value, 'completionRate', 'Python · T0 到完比', 'Python'],
    [pythonGradeT7AttendRef.value, 't7AttendRate', 'Python · T7 到课率', 'Python'], [pythonGradeT7CompletionRef.value, 't7CompletionRate', 'Python · T7 到完比', 'Python'],
    [pythonGradeDurationRef.value, 'durationMedianMs', 'Python · 完课时长中位数', 'Python'],
  ];
  gradeConfigs.forEach(([element, metric, title, subject]) => { if (element) { const chart = echarts.init(element); chart.setOption(gradeCourseChartOption(metric, title, subject)); charts.push(chart); } });
  if (graphicGradeMixRef.value) { const chart = echarts.init(graphicGradeMixRef.value); chart.setOption(gradeMixChartOption('图形化')); charts.push(chart); }
  if (pythonGradeMixRef.value) { const chart = echarts.init(pythonGradeMixRef.value); chart.setOption(gradeMixChartOption('Python')); charts.push(chart); }
}
function lessonRank(sequence: string) { return (dashboard.value?.gradeRows || []).find(row => row.lesson === sequence)?.rank || 999; }
function ensureGradeComparison() { if (!gradeSelectedTerms.value.includes(gradeComparisonTerm.value)) gradeComparisonTerm.value = gradeSelectedTerms.value[0] || ''; }
async function load() { loading.value = true; try { const { data, error } = await fetchMidPriceCourseDashboard(); if (!error && data) { dashboard.value = data; ensureGradeComparison(); } } finally { loading.value = false; await nextTick(); renderCharts(); } }
async function refresh() { refreshing.value = true; try { const { data, error } = await refreshMidPriceCourseDashboard(); if (!error && data) { dashboard.value = data; ensureGradeComparison(); } } finally { refreshing.value = false; await nextTick(); renderCharts(); } }
watch([selectedTerms, selectedCourseTypes, gradeSelectedTerms, gradeSelectedCourseTypes, gradeSubjectDisplay, gradeComparisonMode, gradeComparisonTerm, gradeComparisonGrade, activeTab], async () => { ensureGradeComparison(); await nextTick(); renderCharts(); }, { deep: true });
onMounted(() => { load(); window.addEventListener('resize', renderCharts); });
onBeforeUnmount(() => { window.removeEventListener('resize', renderCharts); charts.forEach(chart => chart.dispose()); });
</script>

<template>
  <div class="page">
    <div class="head">
      <h1>中价课课程看板</h1>
      <NTabs v-model:value="activeTab" type="segment" class="top-tabs"><NTab name="overview">课程总览</NTab><NTab name="grades">年级行课</NTab></NTabs>
      <div class="head-filters">
        <template v-if="activeTab === 'overview'"><NSelect v-model:value="selectedTerms" multiple :options="termOptions" class="term-select" placeholder="期次" /><NSelect v-model:value="selectedCourseTypes" multiple :options="courseTypeOptions" class="course-select" placeholder="课程类型" /></template>
        <template v-else><NSelect v-model:value="gradeSelectedTerms" multiple :options="termOptions" class="term-select" placeholder="期次（年级行课）" /><NSelect v-model:value="gradeSelectedCourseTypes" multiple :options="courseTypeOptions" class="course-select" placeholder="课程分类（年级行课）" /></template>
      </div>
      <div class="head-actions"><span v-if="updatedAt">更新于 {{ updatedAt }}</span><NButton :loading="refreshing" type="primary" @click="refresh">刷新数据</NButton></div>
    </div>
    <NSpin :show="loading">
      <template v-if="dashboard">
        <template v-if="activeTab === 'overview'">
          <NCard class="volume-card"><div ref="volumeRef" class="volume-chart" /></NCard>
          <NCard class="progress-card" title="各期课程解锁进度">
            <div class="progress-grid"><div v-for="item in unlockProgress" :key="item.termName" class="progress-item"><strong>{{ item.termName }}</strong><div v-for="track in item.tracks" :key="track.subject" class="progress-track"><span>{{ track.subject }} · {{ track.currentLesson }}</span><small>已解锁 {{ track.lessonCount }} 课</small></div></div></div>
          </NCard>
          <div class="dashboards live-dashboards">
            <NCard class="subject-panel"><div ref="graphicLiveAttendanceRef" class="chart" /></NCard>
            <NCard class="subject-panel"><div ref="pythonLiveAttendanceRef" class="chart" /></NCard>
          </div>
          <div class="dashboards duration-dashboards">
            <NCard class="subject-panel"><div ref="graphicDurationRef" class="chart" /></NCard>
            <NCard class="subject-panel"><div ref="pythonDurationRef" class="chart" /></NCard>
          </div>
          <div class="dashboards">
            <NCard class="subject-panel" title="图形化（9021）"><div ref="graphicAttendRef" class="chart" /><div ref="graphicCompletionRef" class="chart" /><div ref="graphicT7AttendRef" class="chart" /><div ref="graphicT7CompletionRef" class="chart" /></NCard>
            <NCard class="subject-panel" title="Python（9032）"><div ref="pythonAttendRef" class="chart" /><div ref="pythonCompletionRef" class="chart" /><div ref="pythonT7AttendRef" class="chart" /><div ref="pythonT7CompletionRef" class="chart" /></NCard>
          </div>
          <NCard class="detail-card" title="明细数据"><NDataTable :columns="detailColumns" :data="detailRows" :scroll-x="1840" :bordered="false" size="small" /></NCard>
        </template>
        <template v-else>
          <NCard class="grade-filter">
            <div class="grade-comparison-controls">
              <span class="control-label">对比方式</span>
              <NRadioGroup v-model:value="gradeComparisonMode" name="grade-comparison-mode">
                <NRadioButton value="by-grade">按年级对比</NRadioButton><NRadioButton value="by-term">按期次对比</NRadioButton>
              </NRadioGroup>
              <NRadioGroup v-model:value="gradeSubjectDisplay" name="grade-subject-display">
                <NRadioButton value="all">全部</NRadioButton><NRadioButton value="图形化">图形化</NRadioButton><NRadioButton value="Python">Python</NRadioButton>
              </NRadioGroup>
              <NSelect v-if="gradeComparisonMode === 'by-grade'" v-model:value="gradeComparisonTerm" :options="termOptions.filter(item => gradeSelectedTerms.includes(item.value))" class="comparison-select" placeholder="选择一个期次" />
              <NSelect v-else v-model:value="gradeComparisonGrade" :options="GRADE_ORDER.map(value => ({ label: value, value }))" class="comparison-select" placeholder="选择一个年级" />
              <span class="comparison-note">{{ gradeComparisonMode === 'by-grade' ? '横轴为课程，不同年级为折线' : '横轴为课程，不同期次为分组柱状' }}</span>
            </div>
          </NCard>
          <div class="grade-dashboards" :class="{ 'single-subject': gradeVisibleSubjects.length === 1 }">
            <NCard v-if="gradeVisibleSubjects.includes('图形化')" class="grade-subject-panel" title="图形化（9021）">
              <div class="grade-mix-scroll"><div ref="graphicGradeMixRef" class="grade-mix-chart" :style="{ width: `${gradeMixWidth}px` }" /></div>
              <div ref="graphicGradeAttendRef" class="chart" /><div ref="graphicGradeCompletionRef" class="chart" />
              <div ref="graphicGradeT7AttendRef" class="chart" /><div ref="graphicGradeT7CompletionRef" class="chart" />
              <div ref="graphicGradeDurationRef" class="chart" />
            </NCard>
            <NCard v-if="gradeVisibleSubjects.includes('Python')" class="grade-subject-panel" title="Python（9032）">
              <div class="grade-mix-scroll"><div ref="pythonGradeMixRef" class="grade-mix-chart" :style="{ width: `${gradeMixWidth}px` }" /></div>
              <div ref="pythonGradeAttendRef" class="chart" /><div ref="pythonGradeCompletionRef" class="chart" />
              <div ref="pythonGradeT7AttendRef" class="chart" /><div ref="pythonGradeT7CompletionRef" class="chart" />
              <div ref="pythonGradeDurationRef" class="chart" />
            </NCard>
          </div>
          <NCard class="detail-card" title="年级行课明细"><NDataTable :columns="gradeColumns" :data="filteredGradeRows" :scroll-x="1240" :bordered="false" size="small" /></NCard>
        </template>
      </template>
      <NEmpty v-else-if="!loading" description="暂无可展示数据，请刷新后重试" />
    </NSpin>
  </div>
</template>

<style scoped>
.page{width:100%;padding:24px 32px;margin:0}.head{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:10px;margin-bottom:14px}.head h1{font-size:24px;margin:0;white-space:nowrap}.top-tabs{white-space:nowrap}.head-filters{display:grid;grid-template-columns:minmax(260px,1.2fr) minmax(190px,.85fr) minmax(150px,.65fr);gap:8px;min-width:0}.term-select,.course-select,.subject-select{width:100%;min-width:0}.head-actions{justify-self:end;display:flex;align-items:center;gap:10px}.head-actions span{font-size:12px;color:var(--n-text-color-3);white-space:nowrap}.volume-card,.progress-card,.detail-card,.grade-filter{margin-bottom:14px}.volume-card :deep(.n-card__content){padding:8px 14px}.volume-chart{height:310px}.grade-mix-scroll{overflow-x:auto;padding-bottom:4px}.grade-mix-chart{height:460px}.grade-comparison-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.control-label{font-size:13px;color:var(--n-text-color-3);white-space:nowrap}.comparison-select{width:180px}.comparison-note{font-size:12px;color:var(--n-text-color-3)}.progress-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.progress-item{padding:10px 12px;border-radius:6px;background:var(--n-color-embedded)}.progress-item>strong{display:block;margin-bottom:7px;font-size:15px}.progress-track+.progress-track{margin-top:7px;padding-top:7px;border-top:1px solid var(--n-border-color)}.progress-track span,.progress-track small{display:block;color:var(--n-text-color-3);font-size:12px}.dashboards,.grade-dashboards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}.grade-dashboards.single-subject{grid-template-columns:minmax(0,1fr)}.subject-panel :deep(.n-card-header),.grade-subject-panel :deep(.n-card-header){padding-bottom:0}.chart{height:315px}@media(max-width:1050px){.head{grid-template-columns:auto 1fr auto}.head-filters{grid-column:1 / -1;grid-row:2;grid-template-columns:minmax(280px,1fr) minmax(200px,.7fr) minmax(150px,.5fr)}}@media(max-width:850px){.dashboards,.grade-dashboards,.progress-grid{grid-template-columns:1fr}.head{grid-template-columns:1fr;align-items:stretch}.head-actions{justify-self:start}.head-filters{grid-column:auto;grid-row:auto;grid-template-columns:1fr}.term-select,.course-select,.subject-select{width:100%}.page{padding:14px}.chart{height:300px}.grade-mix-chart{height:390px}}
</style>
