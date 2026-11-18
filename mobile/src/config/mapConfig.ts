export const MAP_CONFIG = {
  /*
   * خريطة شوارع واضحة بدل
   * demo tiles القديمة.
   */
  developmentStyle:
    'https://tiles.openfreemap.org/styles/liberty',

  /*
   * عمّان كـ fallback فقط
   * إذا لم نجد أي إحداثيات.
   */
  defaultCenter: {
    latitude: 31.9539,
    longitude: 35.9106,
  },

  defaultZoom: 12,

  /*
   * مناسب لتتبع الباص
   * وإظهار الشوارع والمباني.
   */
  trackingZoom: 16,
};