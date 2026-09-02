const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  spotifyId: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = User;
