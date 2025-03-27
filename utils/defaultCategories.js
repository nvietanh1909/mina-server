const mongoose = require('mongoose');

const defaultCategories = [
  {
    name: 'Food',
    description: 'Food and beverages',
    icon: '🍔',
    color: '#FF5733',
    icons: [
      { iconPath: '🍔', color: '#FF5733' },
      { iconPath: '🍕', color: '#FF5733' },
      { iconPath: '🍣', color: '#FF5733' },
      { iconPath: '🍜', color: '#FF5733' },
      { iconPath: '🍦', color: '#FF5733' },
      { iconPath: '🍪', color: '#FF5733' }
    ]
  },
  {
    name: 'Transport',
    description: 'Transportation expenses',
    icon: '🚗',
    color: '#33FF57',
    icons: [
      { iconPath: '🚗', color: '#33FF57' },
      { iconPath: '🚕', color: '#33FF57' },
      { iconPath: '🚲', color: '#33FF57' },
      { iconPath: '🚄', color: '#33FF57' },
      { iconPath: '🚌', color: '#33FF57' },
      { iconPath: '🚀', color: '#33FF57' }
    ]
  },
  {
    name: 'Shopping',
    description: 'Shopping expenses',
    icon: '👗',
    color: '#3357FF',
    icons: [
      { iconPath: '👗', color: '#3357FF' },
      { iconPath: '👠', color: '#3357FF' },
      { iconPath: '👒', color: '#3357FF' },
      { iconPath: '👜', color: '#3357FF' },
      { iconPath: '🕶️', color: '#3357FF' },
      { iconPath: '🧥', color: '#3357FF' }
    ]
  },
  {
    name: 'Entertainment',
    description: 'Entertainment expenses',
    icon: '🎬',
    color: '#FF33F6',
    icons: [
      { iconPath: '🎬', color: '#FF33F6' },
      { iconPath: '🎤', color: '#FF33F6' },
      { iconPath: '🎮', color: '#FF33F6' },
      { iconPath: '🎳', color: '#FF33F6' },
      { iconPath: '🎭', color: '#FF33F6' },
      { iconPath: '🎨', color: '#FF33F6' }
    ]
  },
  {
    name: 'Health',
    description: 'Health and medical expenses',
    icon: '💊',
    color: '#33FFF6',
    icons: [
      { iconPath: '💊', color: '#33FFF6' },
      { iconPath: '🩺', color: '#33FFF6' },
      { iconPath: '🌡️', color: '#33FFF6' },
      { iconPath: '💉', color: '#33FFF6' },
      { iconPath: '🧴', color: '#33FFF6' },
      { iconPath: '🚑', color: '#33FFF6' }
    ]
  },
  {
    name: 'Education',
    description: 'Education expenses',
    icon: '📚',
    color: '#F6FF33',
    icons: [
      { iconPath: '📚', color: '#F6FF33' },
      { iconPath: '🎓', color: '#F6FF33' },
      { iconPath: '📝', color: '#F6FF33' },
      { iconPath: '📐', color: '#F6FF33' },
      { iconPath: '📏', color: '#F6FF33' },
      { iconPath: '📖', color: '#F6FF33' }
    ]
  }
];

module.exports = defaultCategories; 