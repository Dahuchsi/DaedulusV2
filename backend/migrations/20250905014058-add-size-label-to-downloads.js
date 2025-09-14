'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('downloads', 'size_label', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'Unknown'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('downloads', 'size_label');
  }
};