// 휴게시간 자동 계산 함수 (근로기준법 제54조 - 수정된 규칙)
export function getBreakMinutes(workMinutes) {
  if (workMinutes < 4 * 60) {
    return 0; // 4시간 미만: 휴게시간 없음
  } else if (workMinutes < 8 * 60) {
    return 30; // 4시간 이상 ~ 8시간 미만: 30분
  } else if (workMinutes === 8 * 60) {
    return 60; // 8시간: 1시간
  } else if (workMinutes <= 12 * 60) {
    return 90; // 8시간 초과 ~ 12시간 이하: 1시간 30분
  } else if (workMinutes <= 16 * 60) {
    return 120; // 12시간 초과 ~ 16시간 이하: 2시간
  } else {
    return 120; // 16시간 초과시에도 최대 2시간
  }
}

// 실무 관행 기반 휴게시간 자동 계산 함수 (예: 9시간 근무=1시간 휴게)
export function getPracticalBreakMinutes(workMinutes) {
  if (workMinutes < 4 * 60) {
    return 0; // 4시간 미만: 휴게시간 없음
  } else if (workMinutes < 8 * 60) {
    return 30; // 4~8시간 미만: 30분
  } else if (workMinutes < 10 * 60) {
    return 60; // 8~10시간 미만: 1시간
  } else if (workMinutes < 12 * 60) {
    return 90; // 10~12시간 미만: 1.5시간
  } else if (workMinutes <= 16 * 60) {
    return 120; // 12~16시간: 2시간
  } else {
    return 120; // 16시간 초과: 2시간(최대)
  }
}

// 시:분 문자열을 분 단위로 변환
export function timeStrToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 분을 시간 문자열로 변환
export function minutesToTimeStr(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}시간${m ? ' ' + m + '분' : ''}`;
}

// 휴게시간 자동 계산 함수 (시작시간, 종료시간 기반)
export function calculateBreakTime(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  
  const start = timeStrToMinutes(startTime);
  const end = timeStrToMinutes(endTime);
  let workMinutes = end > start ? end - start : (end + 24 * 60) - start;
  
  return getBreakMinutes(workMinutes);
}

// 천단위 콤마 처리 유틸리티 함수들
export function formatNumberWithCommas(value) {
  if (!value) return '';
  // 숫자가 아닌 문자 제거 후 천단위 콤마 추가
  const numericValue = value.toString().replace(/[^\d]/g, '');
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseNumberFromCommas(value) {
  if (!value) return '';
  // 콤마 제거 후 숫자만 반환
  return value.toString().replace(/[^\d]/g, '');
}

// 2025년 최신 법적 정보 상수
export const LEGAL_INFO = {
  MIN_WAGE: 10030, // 2025년 최저시급
  MIN_MONTHLY: 2096270, // 2025년 최저월급 (209시간 기준)
  INSURANCE_RATES: {
    NATIONAL_PENSION: 0.09, // 국민연금 9%
    HEALTH_INSURANCE: 0.0709, // 건강보험 7.09%
    LONG_TERM_CARE: 0.009182, // 장기요양보험 0.9182%
    EMPLOYMENT_INSURANCE: 0.018, // 고용보험 1.8%
    INDUSTRIAL_ACCIDENT: 0.0147, // 산재보험 평균 1.47%
  }
};

// 천단위 반올림 함수
export function roundToNearestThousand(value) {
  return Math.round(Number(value) / 1000) * 1000;
}

/**
 * 수습기간 최저임금 하한선 계산 함수
 * @param {number} standardMonthlyHours - 월 소정근로시간
 * @returns {number} 수습기간 최저임금 하한선 (월 소정근로시간 × 최저시급 × 90%)
 */
export function getProbationMinimumWage(standardMonthlyHours) {
  const result = standardMonthlyHours * LEGAL_INFO.MIN_WAGE * 0.9;
  return roundToNearestThousand(result);
}

/**
 * 수습기간 임금 계산 함수 (감액률 적용, 최저임금 하한선 적용)
 * @param {number} baseSalary - 감액 전 기본급
 * @param {number} discountPercent - 감액률(%)
 * @param {number} [standardMonthlyHours] - 월 소정근로시간(시급제 필수)
 * @returns {number} 감액 적용 후 수습기간 임금 (최저임금 하한선 미만시 하한선 적용)
 */
export function calculateProbationSalary(baseSalary, discountPercent, standardMonthlyHours) {
  const discountRate = Number(discountPercent) / 100;
  const discountedSalary = baseSalary * (1 - discountRate);
  if (!standardMonthlyHours || isNaN(standardMonthlyHours) || standardMonthlyHours <= 0) {
    return 0;
  }
  const minimumProbationSalary = getProbationMinimumWage(standardMonthlyHours);
  const result = Math.max(discountedSalary, minimumProbationSalary);
  return roundToNearestThousand(result);
}

// 4대보험료 계산 함수
export function calculateInsurance(baseSalary) {
  const rates = LEGAL_INFO.INSURANCE_RATES;
  return {
    nationalPension: Math.round(baseSalary * rates.NATIONAL_PENSION),
    healthInsurance: Math.round(baseSalary * rates.HEALTH_INSURANCE),
    longTermCare: Math.round(baseSalary * rates.LONG_TERM_CARE),
    employmentInsurance: Math.round(baseSalary * rates.EMPLOYMENT_INSURANCE),
    industrialAccident: Math.round(baseSalary * rates.INDUSTRIAL_ACCIDENT),
    total: Math.round(baseSalary * (rates.NATIONAL_PENSION + rates.HEALTH_INSURANCE + rates.LONG_TERM_CARE + rates.EMPLOYMENT_INSURANCE + rates.INDUSTRIAL_ACCIDENT))
  };
}

// 4대보험 가입 조건 판단 함수
export function checkInsuranceEligibility(weekWorkHours, monthWorkHours) {
  // 주 15시간 이상 또는 월 60시간 이상 근무 시 4대보험 의무가입
  const isEligible = weekWorkHours >= 15 || monthWorkHours >= 60;
  const weekStr = Math.round(weekWorkHours * 10) / 10;
  return {
    isEligible,
    reason: isEligible 
      ? `주 ${weekStr}시간/4대보험 의무가입 대상`
      : `주 ${weekStr}시간/4대보험 의무가입 대상 아님`,
    weekHours: weekWorkHours,
    monthHours: monthWorkHours
  };
}

// 주휴수당 대상 여부 판단 함수
export function checkWeeklyHolidayEligibility(weekWorkHours) {
  // 1주 15시간 이상 근로한 근로자에게 주휴수당 지급
  const isEligible = weekWorkHours >= 15;
  const weekStr = Math.round(weekWorkHours * 10) / 10;
  return {
    isEligible,
    reason: isEligible 
      ? `주 ${weekStr}시간/주휴수당 대상`
      : `주 ${weekStr}시간/주휴수당 대상 아님`,
    weekHours: weekWorkHours
  };
}

// 주휴수당(월) 계산 함수 (시급제 기준)
/**
 * @param {number} hourlyWage - 시급
 * @param {number} weeklyWorkHours - 주간 근로시간
 * @returns {number} 월 주휴수당
 */
export function calculateWeeklyHolidayPay(hourlyWage, weeklyWorkHours) {
  let weeklyHolidayPay = 0;
  if (weeklyWorkHours >= 40) {
    weeklyHolidayPay = hourlyWage * 8;
  } else if (weeklyWorkHours >= 15) {
    weeklyHolidayPay = hourlyWage * (weeklyWorkHours / 40) * 8;
  } else {
    weeklyHolidayPay = 0;
  }
  const result = weeklyHolidayPay * 4.345; // 월평균 주수
  return roundToNearestThousand(result);
}

/**
 * 월급제 법적 최소 임금 계산 함수 (공통화)
 * @param {number} monthlyWorkHours - 월간 근무시간(시간)
 * @param {number} weeklyWorkHours - 주간 근무시간(시간)
 * @param {number} overtimeHours - 월간 연장근로시간(시간)
 * @param {number} nightHours - 월간 야간근로시간(시간)
 * @param {number} [hourlyWage=LEGAL_INFO.MIN_WAGE] - 시급(기본값: 최저임금)
 * @returns {object} { basicMinimumWage, weeklyHolidayPay, overtimePay, nightPay, totalMinimumWage }
 */
export function calculateMinimumMonthlyWageToLegalStandard({
  monthlyWorkHours,
  weeklyWorkHours,
  overtimeHours = 0,
  nightHours = 0,
  hourlyWage = LEGAL_INFO.MIN_WAGE
}) {
  // 기본 최저임금 (월간 근무시간 × 시급)
  const basicMinimumWage = monthlyWorkHours * hourlyWage;

  // 주휴수당 계산 (1주 15시간 이상 근로 시)
  let weeklyHolidayPay = 0;
  if (weeklyWorkHours >= 40) {
    weeklyHolidayPay = hourlyWage * 8 * 4.345;
  } else if (weeklyWorkHours >= 15) {
    weeklyHolidayPay = hourlyWage * (weeklyWorkHours / 40) * 8 * 4.345;
  }
  weeklyHolidayPay = roundToNearestThousand(weeklyHolidayPay);

  // 연장근로수당 계산
  const overtimePay = roundToNearestThousand(overtimeHours * hourlyWage * 0.5);

  // 야간근로수당 계산
  const nightPay = roundToNearestThousand(nightHours * hourlyWage * 0.5);

  // 총 법적 최소 임금
  const totalMinimumWage = Math.round(basicMinimumWage + weeklyHolidayPay + overtimePay + nightPay);

  return {
    basicMinimumWage: Math.round(basicMinimumWage),
    weeklyHolidayPay,
    overtimePay,
    nightPay,
    totalMinimumWage,
    monthlyWorkHours: Math.round(monthlyWorkHours * 10) / 10,
    weeklyWorkHours: Math.round(weeklyWorkHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    nightHours: Math.round(nightHours * 10) / 10
  };
} 