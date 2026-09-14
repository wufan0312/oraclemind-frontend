// 出生城市经纬度表（供占星本命盘计算）。
// tz = 该城市所在时区的标准时 UTC 偏移（小时）。占星计算必须把本地时间按此偏移换算为 UT，
// 否则上升点与宫位会整体偏移（东八区约 120°）。注意：tz 为标准时，未含夏令时。

export interface City {
  name: string;
  lat: number;
  lng: number;
  region: '中国' | '世界';
  /** 标准时 UTC 偏移（小时），如北京 8、纽约 -5、新德里 5.5 */
  tz: number;
}

export const CITIES: City[] = [
  // ---------- 中国主要城市 ----------
  { name: '北京', lat: 39.9042, lng: 116.4074, region: '中国', tz: 8 },
  { name: '上海', lat: 31.2304, lng: 121.4737, region: '中国', tz: 8 },
  { name: '广州', lat: 23.1291, lng: 113.2644, region: '中国', tz: 8 },
  { name: '深圳', lat: 22.5431, lng: 114.0579, region: '中国', tz: 8 },
  { name: '成都', lat: 30.5728, lng: 104.0668, region: '中国', tz: 8 },
  { name: '杭州', lat: 30.2741, lng: 120.1551, region: '中国', tz: 8 },
  { name: '武汉', lat: 30.5928, lng: 114.3055, region: '中国', tz: 8 },
  { name: '西安', lat: 34.3416, lng: 108.9398, region: '中国', tz: 8 },
  { name: '南京', lat: 32.0603, lng: 118.7969, region: '中国', tz: 8 },
  { name: '重庆', lat: 29.563, lng: 106.5516, region: '中国', tz: 8 },
  { name: '天津', lat: 39.3434, lng: 117.3616, region: '中国', tz: 8 },
  { name: '苏州', lat: 31.2989, lng: 120.5853, region: '中国', tz: 8 },
  { name: '长沙', lat: 28.2282, lng: 112.9388, region: '中国', tz: 8 },
  { name: '青岛', lat: 36.0671, lng: 120.3826, region: '中国', tz: 8 },
  { name: '大连', lat: 38.914, lng: 121.6147, region: '中国', tz: 8 },
  { name: '厦门', lat: 24.4798, lng: 118.0894, region: '中国', tz: 8 },
  { name: '昆明', lat: 24.8801, lng: 102.8329, region: '中国', tz: 8 },
  { name: '哈尔滨', lat: 45.8038, lng: 126.535, region: '中国', tz: 8 },
  { name: '沈阳', lat: 41.8057, lng: 123.4315, region: '中国', tz: 8 },
  { name: '济南', lat: 36.6512, lng: 117.1201, region: '中国', tz: 8 },
  { name: '郑州', lat: 34.7466, lng: 113.6254, region: '中国', tz: 8 },
  { name: '合肥', lat: 31.8206, lng: 117.2272, region: '中国', tz: 8 },
  { name: '福州', lat: 26.0745, lng: 119.2965, region: '中国', tz: 8 },
  { name: '南昌', lat: 28.6829, lng: 115.8579, region: '中国', tz: 8 },
  { name: '贵阳', lat: 26.6477, lng: 106.6302, region: '中国', tz: 8 },
  { name: '兰州', lat: 36.0611, lng: 103.8343, region: '中国', tz: 8 },
  { name: '海口', lat: 20.044, lng: 110.1999, region: '中国', tz: 8 },
  { name: '南宁', lat: 22.817, lng: 108.3665, region: '中国', tz: 8 },
  { name: '太原', lat: 37.8706, lng: 112.5489, region: '中国', tz: 8 },
  { name: '石家庄', lat: 38.0428, lng: 114.5149, region: '中国', tz: 8 },
  { name: '长春', lat: 43.8171, lng: 125.3235, region: '中国', tz: 8 },
  { name: '呼和浩特', lat: 40.8424, lng: 111.7491, region: '中国', tz: 8 },
  { name: '银川', lat: 38.4872, lng: 106.2309, region: '中国', tz: 8 },
  { name: '西宁', lat: 36.6171, lng: 101.7782, region: '中国', tz: 8 },
  { name: '乌鲁木齐', lat: 43.8256, lng: 87.6168, region: '中国', tz: 8 },
  { name: '拉萨', lat: 29.652, lng: 91.1721, region: '中国', tz: 8 },
  { name: '香港', lat: 22.3193, lng: 114.1694, region: '中国', tz: 8 },
  { name: '澳门', lat: 22.1987, lng: 113.5439, region: '中国', tz: 8 },
  { name: '台北', lat: 25.033, lng: 121.5654, region: '中国', tz: 8 },

  // ---------- 世界主要城市 ----------
  { name: '东京', lat: 35.6762, lng: 139.6503, region: '世界', tz: 9 },
  { name: '新加坡', lat: 1.3521, lng: 103.8198, region: '世界', tz: 8 },
  { name: '首尔', lat: 37.5665, lng: 126.978, region: '世界', tz: 9 },
  { name: '曼谷', lat: 13.7563, lng: 100.5018, region: '世界', tz: 7 },
  { name: '新德里', lat: 28.6139, lng: 77.209, region: '世界', tz: 5.5 },
  { name: '迪拜', lat: 25.2048, lng: 55.2708, region: '世界', tz: 4 },
  { name: '伦敦', lat: 51.5074, lng: -0.1278, region: '世界', tz: 0 },
  { name: '巴黎', lat: 48.8566, lng: 2.3522, region: '世界', tz: 1 },
  { name: '柏林', lat: 52.52, lng: 13.405, region: '世界', tz: 1 },
  { name: '莫斯科', lat: 55.7558, lng: 37.6173, region: '世界', tz: 3 },
  { name: '纽约', lat: 40.7128, lng: -74.006, region: '世界', tz: -5 },
  { name: '洛杉矶', lat: 34.0522, lng: -118.2437, region: '世界', tz: -8 },
  { name: '旧金山', lat: 37.7749, lng: -122.4194, region: '世界', tz: -8 },
  { name: '多伦多', lat: 43.6532, lng: -79.3832, region: '世界', tz: -5 },
  { name: '悉尼', lat: -33.8688, lng: 151.2093, region: '世界', tz: 10 },
  { name: '墨尔本', lat: -37.8136, lng: 144.9631, region: '世界', tz: 10 },
];
