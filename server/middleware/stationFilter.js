// إضافة فلتر المحطة تلقائياً للطلبات — يمنع تسريب البيانات بين المحطات
const injectStationFilter = (req, res, next) => {
  if (req.user && req.user.stationId) {
    req.stationFilter = { stationId: req.user.stationId };
  }
  next();
};

module.exports = { injectStationFilter };
