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

  // Helper function to calculate age from Date of Birth
  export function calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }