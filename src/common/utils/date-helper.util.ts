/* eslint-disable prettier/prettier */

export function getMonthRange(monthOffset: number = 0) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); //

  const targetStartDate = new Date(currentYear, currentMonth + monthOffset, 1, 0, 0, 0, 0);
  
  const targetEndDate = new Date(currentYear, currentMonth + monthOffset + 1, 0, 23, 59, 59, 999);

  return {
    startDate: targetStartDate,
    endDate: targetEndDate,
  };
}