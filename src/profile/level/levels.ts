/********
 *
 * Users levels definitions
 * (hardcoded)
 *
 */

export enum UserLevel {
  LEVEL_0 = 0,
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
  LEVEL_5 = 5,
  LEVEL_6 = 6,
  LEVEL_7 = 7,
  LEVEL_8 = 8,
  LEVEL_9 = 9
}

export const USER_LEVELS: { [key: number]: { points_trigger: number } } = {
  0: {
    points_trigger: 0
  },
  1: {
    points_trigger: 10
  },
  2: {
    points_trigger: 20
  },
  3: {
    points_trigger: 50
  },
  4: {
    points_trigger: 100
  },
  5: {
    points_trigger: 200
  },
  6: {
    points_trigger: 500
  },
  7: {
    points_trigger: 1000
  },
  8: {
    points_trigger: 2000
  },
  9: {
    points_trigger: 5000
  }
};

export const getLevelFromPoints = (points: number): UserLevel => {
  let userLevel = UserLevel.LEVEL_0;

  for (let level = 0; level < Object.keys(USER_LEVELS).length; level++) {
    if (points >= USER_LEVELS[level].points_trigger) {
      userLevel = level;
    }
  }
  return userLevel;
};
