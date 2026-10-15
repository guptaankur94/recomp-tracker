// Dates are local-time sensitive (a 1 a.m. workout belongs to that day), so tests run in a fixed zone that isn't UTC.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
