 const generateCustomId = (prefix) => {
  const timestamp = new Date().getTime();
  const randomNum = Math.floor(Math.random() * 100000);
  return `${prefix}-${timestamp}${randomNum}`;
};

module.exports = {
    generateCustomId
}
