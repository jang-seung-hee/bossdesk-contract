import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 스텝 진행상황 관련 변수들

const steps = [
  '사업장 정보',
  '근로자 정보', 
  '계약 기간',
  '근무 조건',
  '근로시간',
  '임금 조건',
  '수습기간',
  '기타 사항',
  '최종 확인',
];

// 2025년 최신 법적 정보
const LEGAL_INFO = {
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

// 시간 계산 유틸
function getMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getHourStr(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}시간${m ? ' ' + m + '분' : ''}`;
}

function calcWorkStats(form) {
  let totalWeek = 0, totalMonth = 0, night = 0, over = 0;
  const dayStats = {};
  const NIGHT_START = 22 * 60, NIGHT_END = 6 * 60; // 22:00~06:00
  form.days.forEach(day => {
    let s, e, br;
    if (form.workTimeType === 'same') {
      s = getMinutes(form.commonStart);
      e = getMinutes(form.commonEnd);
      br = Number(form.commonBreak) || 0;
    } else {
      s = getMinutes(form.dayTimes[day]?.start);
      e = getMinutes(form.dayTimes[day]?.end);
      br = Number(form.dayTimes[day]?.break) || 0;
    }
    if ((!s && !e) || e === s) { dayStats[day] = { work: 0, night: 0, over: 0 }; return; }
    let work = e > s ? e - s : (e + 24 * 60) - s;
    work = Math.max(0, work - br); // 휴게시간 차감
    let nightMin = 0;
    // 야간근로 계산
    for (let t = s; t < s + work + br; t += 10) {
      const cur = t % (24 * 60);
      if (cur >= NIGHT_START || cur < NIGHT_END) nightMin += 10;
    }
    // 연장근로(1일 8시간 초과)
    let overMin = work > 480 ? work - 480 : 0;
    dayStats[day] = { work, night: nightMin, over: overMin };
    totalWeek += work;
    night += nightMin;
    over += overMin;
  });
  totalMonth = Math.round(totalWeek * 4.345); // 월평균 주수
  return { dayStats, totalWeek, totalMonth, night, over };
}

// 수습기간 임금 계산 함수
function calculateProbationSalary(baseSalary, discountPercent) {
  const discountRate = Number(discountPercent) / 100;
  const discountedSalary = baseSalary * (1 - discountRate);
  const minimumProbationSalary = LEGAL_INFO.MIN_MONTHLY * 0.9; // 최저임금의 90%
  
  // 감액된 임금이 최저임금의 90%보다 낮으면 최저임금의 90%로 설정
  return Math.max(discountedSalary, minimumProbationSalary);
}

// 4대보험료 계산 함수 추가
function calculateInsurance(baseSalary) {
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

function ContractForm() {
  const [form, setForm] = useState({
    // 사업장 정보
    storeName: '스타벅스 강남점', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    owner: '김철수', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    address: '서울특별시 강남구 테헤란로 123', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    addressDetail: '456동 789호', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    storeContact: '02-1234-5678', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    // 근로자 정보
    name: '박영희', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    birth: (() => {
      const today = new Date();
      const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      return eighteenYearsAgo.toISOString().split('T')[0];
    })(),
    contact: '010-9876-5432', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    workerAddress: '서울특별시 서초구 서초대로 456', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    workerAddressDetail: '101동 202호', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    // 계약 기간
    periodStart: '2025-01-01', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    periodEnd: '2025-12-31', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    probationPeriod: '3개월', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    probationDiscount: '10', // 수습기간 감액률 (%)
    // 근무 조건
    workLocation: '스타벅스 강남점 매장', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    jobDesc: '바리스타', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    position: '사원', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    // 근로시간
    workTimeType: 'same', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    days: ['월', '화', '수', '목', '금'], // 테스트용 임시데이터 - 테스트 완료 후 []로 변경
    dayTimes: {}, // { '월': {start: '', end: '', break: ''}, ... }
    commonStart: '09:00', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    commonEnd: '18:00', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    commonBreak: '60', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    // 임금 조건
    salaryType: 'hourly', // 테스트용 임시데이터 - 테스트 완료 후 'monthly'로 변경
    baseSalary: '', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    hourlyWage: '12000', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    allowances: '200000', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    totalSalary: '', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    payday: '매월 25일', // 테스트용 임시데이터 - 테스트 완료 후 ''로 변경
    paymentMethod: '계좌이체',
    // 기타 사항
    socialInsurance: true,
    terminationTypes: ['mutual_agreement'], // 계약 해지 조건 타입들 (다중 선택)
    termination: '', // 직접 입력용 (custom 선택 시)
    confidentiality: true,
    contractCopies: 2,
  });
  const [step, setStep] = useState(0);
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

// 계약 해지 조건 옵션 (MECE 분류)
const terminationOptions = [
  {
    category: "계약기간 만료",
    options: [
      {
        value: "contract_expiry",
        label: "계약기간 만료 시 자동 해지",
        description: "계약서에 명시된 계약기간이 만료되면 자동으로 계약이 종료됩니다."
      }
    ]
  },
  {
    category: "상호 합의",
    options: [
      {
        value: "mutual_agreement",
        label: "상호 합의에 의한 해지",
        description: "갑과 을이 서로 합의하여 계약을 해지할 수 있습니다."
      },
      {
        value: "mutual_agreement_30days",
        label: "상호 합의 (30일 전 통지)",
        description: "갑과 을이 서로 합의하여 30일 전 서면 통지 후 계약을 해지할 수 있습니다."
      }
    ]
  },
  {
    category: "사용자 사유",
    options: [
      {
        value: "employer_business_reason",
        label: "사업상 필요에 의한 해지",
        description: "사업의 폐지, 경영상 필요 등 정당한 사유가 있는 경우 30일 전 통지 후 해지할 수 있습니다."
      },
      {
        value: "employer_30days",
        label: "사용자 사유 (30일 전 통지)",
        description: "사용자가 30일 전 서면 통지 후 계약을 해지할 수 있습니다."
      },
      {
        value: "employer_60days",
        label: "사용자 사유 (60일 전 통지)",
        description: "사용자가 60일 전 서면 통지 후 계약을 해지할 수 있습니다."
      }
    ]
  },
  {
    category: "근로자 사유",
    options: [
      {
        value: "employee_30days",
        label: "근로자 사유 (30일 전 통지)",
        description: "근로자가 30일 전 서면 통지 후 계약을 해지할 수 있습니다."
      },
      {
        value: "employee_14days",
        label: "근로자 사유 (14일 전 통지)",
        description: "근로자가 14일 전 서면 통지 후 계약을 해지할 수 있습니다."
      }
    ]
  },
  {
    category: "법적 사유",
    options: [
      {
        value: "legal_violation",
        label: "법령 위반 시 즉시 해지",
        description: "근로기준법 등 관련 법령을 위반하는 경우 즉시 계약을 해지할 수 있습니다."
      },
      {
        value: "serious_misconduct",
        label: "중대한 위반행위 시 해지",
        description: "근로자가 중대한 위반행위를 한 경우 즉시 계약을 해지할 수 있습니다."
      }
    ]
  },
  {
    category: "기타",
    options: [
      {
        value: "custom",
        label: "직접 입력",
        description: "사용자가 직접 계약 해지 조건을 입력합니다."
      }
    ]
  }
];

// 계약 해지 조건 텍스트 생성 함수
function getTerminationText(form) {
  if (!form.terminationTypes || form.terminationTypes.length === 0) {
    return '계약 해지 조건이 설정되지 않았습니다.';
  }
  
  const selectedOptions = [];
  
  form.terminationTypes.forEach(type => {
    if (type === 'custom') {
      if (form.termination) {
        selectedOptions.push(form.termination);
      }
    } else {
      const option = terminationOptions.flatMap(cat => cat.options).find(opt => opt.value === type);
      if (option) {
        selectedOptions.push(option.label);
      }
    }
  });
  
  return selectedOptions.length > 0 ? selectedOptions.join(', ') : '계약 해지 조건이 설정되지 않았습니다.';
}

const navigate = useNavigate();

  // 카카오 주소 API 스크립트 동적 로드
  React.useEffect(() => {
    if (!window.daum) {
      const script = document.createElement('script');
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, checked, dataset } = e.target;
    
    if (name === 'days') {
      setForm((prev) => {
        const newDays = checked
          ? [...prev.days, value]
          : prev.days.filter((d) => d !== value);
        // days에서 빠진 요일의 시간 정보도 삭제
        const newDayTimes = { ...prev.dayTimes };
        if (!checked) delete newDayTimes[value];
        return { ...prev, days: newDays, dayTimes: newDayTimes };
      });
    } else if (name === 'dayStart' || name === 'dayEnd') {
      const day = dataset.day;
      setForm((prev) => {
        const newDayTimes = {
          ...prev.dayTimes,
          [day]: {
            ...prev.dayTimes[day],
            [name.replace('day', '').toLowerCase()]: value,
          },
        };
        
        // 출근/퇴근 시간이 모두 입력되면 휴게시간 자동 계산
        if (newDayTimes[day]?.start && newDayTimes[day]?.end) {
          const breakTime = calculateBreakTime(newDayTimes[day].start, newDayTimes[day].end);
          newDayTimes[day].break = breakTime.toString();
        }
        
        return {
          ...prev,
          dayTimes: newDayTimes,
        };
      });
    } else if (name === 'dayBreak') {
      // 휴게시간 수동 입력은 더 이상 허용하지 않음
      return;
    } else if (name === 'terminationTypes') {
      // 계약 해지 조건 다중 선택 처리
      setForm((prev) => {
        const newTerminationTypes = checked
          ? [...prev.terminationTypes, value]
          : prev.terminationTypes.filter((type) => type !== value);
        
        // custom이 선택 해제되면 직접 입력 텍스트도 초기화
        const newForm = {
          ...prev,
          terminationTypes: newTerminationTypes,
        };
        
        if (!checked && value === 'custom') {
          newForm.termination = '';
        }
        
        return newForm;
      });
    } else if (name === 'birth') {
      // 미성년자 검증
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        alert('미성년자(만 18세 미만)는 근로계약서 작성이 제한됩니다. 미성년자 근로는 특별한 법적 보호 규정이 적용되므로, 법률 전문가와 상담 후 진행하시기 바랍니다.');
        return;
      }
      
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: e.target.type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleAddressSearch = () => {
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: function(data) {
          setForm(prev => ({
            ...prev,
            address: data.address,
            addressDetail: ''
          }));
        }
      }).open();
    } else {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleSavePDF = async () => {
    // 표준근로계약서 HTML 생성
    const contractDate = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // 시급제 계산을 위한 변수들
    const workStats3 = calcWorkStats(form);
    const hourlyWage = Number(form.hourlyWage) || 0;
    const allowances = Number(form.allowances) || 0;
    const basePay = Number(form.baseSalary) || 0;
    
    // 시급제 계산
    let calculatedMonthlySalary = 0, overtimePay = 0, nightPay = 0, monthlyHolidayPay = 0;
    let monthlyWorkHours = 0, overtimeHours = 0, nightHours = 0;
    let totalCalculatedSalary = 0;
    
    if (form.salaryType === 'hourly' && hourlyWage > 0) {
      monthlyWorkHours = workStats3.totalMonth;
      const weeklyWorkHours = workStats3.totalWeek;
      
      calculatedMonthlySalary = hourlyWage * (monthlyWorkHours / 60);
      overtimeHours = workStats3.over;
      overtimePay = hourlyWage * 0.5 * (overtimeHours / 60);
      nightHours = workStats3.night;
      nightPay = hourlyWage * 0.5 * (nightHours / 60);
      
      // 주휴수당 계산 (1주 15시간 이상 근로 시, 8시간 기준)
      let weeklyHolidayPay = 0;
      if (weeklyWorkHours >= 15) {
        weeklyHolidayPay = hourlyWage * 8; // 주휴수당은 8시간 기준
      }
      monthlyHolidayPay = weeklyHolidayPay * 4.345;
      
      // 시급제 총 임금 계산
      totalCalculatedSalary = calculatedMonthlySalary + overtimePay + nightPay + monthlyHolidayPay + allowances;
    }

    // 4대보험료 계산
    // 4대보험료는 실제 총 월 임금(수당 포함) 기준으로 산정
    const baseSalaryForInsurance = form.salaryType === 'monthly' ? (basePay + allowances) : totalCalculatedSalary;
    const insurance = calculateInsurance(baseSalaryForInsurance);
    
    // 수습기간 임금 계산
    const totalSalaryForProbation = form.salaryType === 'monthly' ? (basePay + allowances) : totalCalculatedSalary;
    const probationSalary = form.probationPeriod ? calculateProbationSalary(totalSalaryForProbation, form.probationDiscount) : 0;
    const probationDiscountRate = Number(form.probationDiscount) / 100;
    const originalDiscountedSalary = totalSalaryForProbation * (1 - probationDiscountRate);
    const isMinimumApplied = probationSalary > originalDiscountedSalary;
    
    const baseSalary = form.salaryType === 'monthly' 
      ? (form.baseSalary ? Number(form.baseSalary).toLocaleString() : '[0,000,000]')
      : (form.hourlyWage ? `${form.hourlyWage.toLocaleString()}원/시간` : '[0,000]원/시간');
    const allowancesText = form.allowances ? Number(form.allowances).toLocaleString() : '[식대, 교통비, 직책수당 등]';
    const totalSalary = form.salaryType === 'monthly'
      ? (form.baseSalary && form.allowances 
          ? (Number(form.baseSalary) + Number(form.allowances)).toLocaleString() 
          : '[0,000,000]')
      : (form.salaryType === 'hourly' && hourlyWage > 0 
          ? `${Math.round(totalCalculatedSalary).toLocaleString()}원 (시급제 계산)`
          : '[시급제 계산 참조]');

    const workTimeText = form.workTimeType === 'same' 
      ? `1일 8시간, 1주 40시간 (${form.days.join(', ')}, ${form.commonStart || '09:00'} ~ ${form.commonEnd || '18:00'})`
      : `요일별 상이 (${form.days.join(', ')})`;

    const breakText = form.workTimeType === 'same'
      ? `1일 1시간 (근로시간 중 ${form.commonStart || '12:00'} ~ ${form.commonEnd || '13:00'})`
      : '요일별 상이';

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>표준 근로계약서</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Custom font for better readability */
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f4f8; /* Light blue-gray background */
        }
        /* Custom scrollbar for a cleaner look */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #e2e8f0;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #64748b;
        }
        /* Styling for the main content area */
        .contract-container {
            max-width: 900px;
            margin: 2rem auto;
            padding: 2.5rem;
            background: linear-gradient(135deg, #ffffff, #f8fafc); /* Subtle gradient background */
            border-radius: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        /* Section title styling */
        .section-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b; /* Darker text for titles */
            margin-top: 2rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #cbd5e1; /* Light gray border */
        }
        /* Icon styling (using simple shapes/emojis as placeholders for clip art) */
        .icon {
            font-size: 1.8rem;
            line-height: 1;
        }
        /* Table styling */
        .contract-table th, .contract-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
        }
        .contract-table th {
            background-color: #f8fafc;
            font-weight: 600;
            color: #475569;
        }
        .contract-table tr:last-child td {
            border-bottom: none;
        }
        /* Highlighted text for important notes */
        .note {
            background-color: #e0f2fe; /* Light blue background */
            border-left: 5px solid #38b2ac; /* Teal border */
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1.5rem;
            color: #0c4a6e;
        }
        @media print {
            body {
                background: white;
            }
            .contract-container {
                margin: 0;
                padding: 1rem;
                box-shadow: none;
                border-radius: 0;
                border: none;
            }
            .no-print {
                display: none;
            }
        }
        .contract-table th.col-label,
        .contract-table td.col-label {
            width: 200px;
            min-width: 160px;
            max-width: 240px;
            word-break: keep-all;
            white-space: nowrap;
            text-align: left;
        }
        .contract-table th.col-content,
        .contract-table td.col-content {
            width: auto;
            word-break: break-all;
            text-align: left;
        }
    </style>
</head>
<body class="p-4 sm:p-6 md:p-8">
    <div class="contract-container">
        <!-- Header Section -->
        <header class="text-center mb-10">
            <h1 class="text-4xl font-extrabold text-blue-800 mb-4 tracking-tight">
                표준 근로계약서
            </h1>
            <p class="text-lg text-gray-600" style="font-size: 1.35rem; color: #111; font-weight: 500;">
                근로기준법을 준수하며, 상호 신뢰와 존중을 바탕으로 합니다.
            </p>

        </header>

        <!-- 2025년 법적 정보 안내 -->
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-yellow-800">■ 2025년 최신 법적 정보</h3>
                    <div class="mt-2 text-sm text-yellow-700">
                        <p>• 최저시급: ${LEGAL_INFO.MIN_WAGE.toLocaleString()}원/시간</p>
                        <p>• 최저월급: ${LEGAL_INFO.MIN_MONTHLY.toLocaleString()}원 (209시간 기준)</p>
                        <p>• 4대보험료: 국민연금 4.5%, 건강보험 3.545%, 장기요양보험 0.4591%, 고용보험 0.9%, 산재보험 업종별</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- General Information Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제1조 (계약의 목적)
            </h2>
            <p class="text-gray-700 leading-relaxed">
                본 계약은 ${form.storeName || '[회사명]'} (이하 "갑"이라 한다)과 ${form.name || '[근로자명]'} (이하 "을"이라 한다) 간에 근로기준법 및 기타 관련 법규에 의거하여 근로 조건을 명확히 하고, 상호 간의 권리와 의무를 성실히 이행함을 목적으로 한다.
            </p>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 계약의 기본 원칙</p>
                <p>근로계약은 근로기준법 제2조에 따라 근로자와 사용자 간에 근로조건을 정하는 계약입니다. 본 계약은 법이 정한 최저 기준을 준수하며, 근로기준법에 미달하는 근로조건은 무효가 되고 그 부분은 근로기준법에 따릅니다 (근로기준법 제6조).</p>
            </div>
        </section>

        <!-- Parties Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제2조 (당사자)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>갑 (사용자)</strong></td>
                            <td>
                                <p><strong>회사명:</strong> ${form.storeName || '[회사명]'}</p>
                                <p><strong>대표자:</strong> ${form.owner || '[대표자명]'}</p>
                                <p><strong>주소:</strong> ${form.address || '[회사 주소]'} ${form.addressDetail || ''}</p>
                                <p><strong>연락처:</strong> ${form.storeContact || '[회사 연락처]'}</p>
                            </td>
                        </tr>
                        <tr>
                            <td><strong>을 (근로자)</strong></td>
                            <td>
                                <p><strong>성명:</strong> ${form.name || '[근로자명]'}</p>
                                <p><strong>생년월일:</strong> ${form.birth || '[YYYY년 MM월 DD일]'}</p>
                                <p><strong>주소:</strong> ${form.workerAddress || '[근로자 주소]'} ${form.workerAddressDetail || ''}</p>
                                <p><strong>연락처:</strong> ${form.contact || '[근로자 연락처]'}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 당사자 정보의 중요성</p>
                <p>사용자와 근로자의 정확한 정보는 계약의 유효성을 확인하고, 향후 발생할 수 있는 법적 분쟁 시 당사자를 명확히 하는 데 필수적입니다. 특히 근로자의 개인정보는 「개인정보 보호법」에 따라 안전하게 관리되어야 합니다.</p>
            </div>
        </section>

        <!-- Employment Period Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제3조 (근로계약 기간)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="col-label rounded-tl-lg">구분</th>
                            <th class="col-content">내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="col-label"><strong>계약 시작일</strong></td>
                            <td class="col-content">${form.periodStart || '[YYYY년 MM월 DD일]'}</td>
                        </tr>
                        <tr>
                            <td class="col-label"><strong>계약 종료일</strong></td>
                            <td class="col-content">${form.periodEnd || '기간의 정함이 없음'}</td>
                        </tr>
                        <tr>
                            <td class="col-label"><strong>수습 기간</strong></td>
                            <td class="col-content">${form.probationPeriod || '없음'}</td>
                        </tr>
                        ${form.probationPeriod ? `
                        <tr>
                            <td class="col-label"><strong>수습기간 만료 후</strong></td>
                            <td class="col-content">수습기간 중 업무 능력 및 태도를 평가하며, 평가 결과에 따라 본 채용 여부가 결정됩니다. 수습 종료 후 1개월 이내에 별도 통지가 없으면 정식 채용된 것으로 간주합니다.</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 근로계약 기간 및 수습</p>
                <p>근로계약은 기간을 정할 수도 있고(기간제 근로), 기간을 정하지 않을 수도 있습니다(정규직). 기간제 근로계약은 원칙적으로 2년을 초과할 수 없으며, 2년을 초과하여 사용하는 경우 기간의 정함이 없는 근로자로 간주됩니다 (기간제법 제4조).</p>
                <p>수습 기간은 근로자의 업무 적응 및 능력 평가를 위한 기간으로, 근로기준법 제35조 및 동법 시행령 제3조에 따라 3개월 이내의 수습 근로자에 대해서는 해고예고 규정이 적용되지 않을 수 있으며, 최저임금의 90% 이상을 지급할 수 있습니다.</p>
            </div>
        </section>

        <!-- Work Location & Job Description Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제4조 (근무 장소 및 업무 내용)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>근무 장소</strong></td>
                            <td>${form.workLocation || form.address || '[회사 주소]'}</td>
                        </tr>
                        <tr>
                            <td><strong>업무 내용</strong></td>
                            <td>${form.jobDesc || '[담당 업무 상세 기재]'}</td>
                        </tr>
                        <tr>
                            <td><strong>직위/직책</strong></td>
                            <td>${form.position || '[직위/직책]'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 근무 장소 및 업무의 명확화</p>
                <p>근무 장소와 업무 내용은 근로계약의 중요한 요소입니다. 이는 근로자의 권리 보호뿐만 아니라, 사용자의 인사권 행사 범위에도 영향을 미칩니다. 업무 내용이 포괄적일 경우 향후 업무 지시 범위에 대한 분쟁이 발생할 수 있으므로 최대한 구체적으로 명시하는 것이 좋습니다.</p>
            </div>
        </section>

        <!-- Working Hours & Rest Hours Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제5조 (근로시간 및 휴게시간)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>소정 근로시간</strong></td>
                            <td>${workTimeText}</td>
                        </tr>
                        <tr>
                            <td><strong>휴게 시간</strong></td>
                            <td>${breakText} (근로시간 중 근로자와 협의하여 부여)</td>
                        </tr>
                        <tr>
                            <td><strong>연장/야간/휴일 근로</strong></td>
                            <td>갑의 지시 또는 을의 동의 하에 가능하며, 근로기준법에 따라 가산수당 지급 (연장근로는 주 12시간을 한도로 함)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 근로시간 및 가산수당</p>
                <p>근로기준법 제50조에 따라 1주간의 근로시간은 40시간을, 1일의 근로시간은 8시간을 초과할 수 없습니다. 휴게시간은 근로시간 4시간에 30분 이상, 8시간에 1시간 이상을 부여해야 하며 (근로기준법 제54조), 자유롭게 이용할 수 있어야 합니다.</p>
                <p>연장근로(1주 12시간 한도), 야간근로(오후 10시부터 오전 6시까지), 휴일근로에 대해서는 통상임금의 50% 이상을 가산하여 지급해야 합니다 (근로기준법 제56조). 주 52시간 근무제는 연장근로를 포함한 총 근로시간을 의미합니다.</p>
            </div>
        </section>

        <!-- Holidays & Leaves Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제6조 (휴일 및 휴가)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>주휴일</strong></td>
                            <td>매주 일요일 (주 1회 유급 휴일)</td>
                        </tr>
                        <tr>
                            <td><strong>법정 공휴일</strong></td>
                            <td>「관공서의 공휴일에 관한 규정」에 따른 유급 휴일</td>
                        </tr>
                        <tr>
                            <td><strong>연차 유급 휴가</strong></td>
                            <td>근로기준법에 따라 부여 (입사 1년 미만 시 1개월 개근 시 1일, 1년 이상 시 15일 등)</td>
                        </tr>
                        <tr>
                            <td><strong>기타 휴가</strong></td>
                            <td>경조사 휴가 등 회사의 취업규칙에 따름</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 휴일 및 연차 유급 휴가</p>
                <p>주휴일은 1주간 소정근로일을 개근한 근로자에게 주어지는 유급 휴일입니다 (근로기준법 제55조). 법정 공휴일은 2022년부터 모든 사업장에 유급 휴일로 적용됩니다.</p>
                <p>연차 유급 휴가는 근로기준법 제60조에 따라 1년간 80% 이상 출근한 근로자에게 15일이 부여되며, 3년 이상 계속 근로 시 2년마다 1일씩 가산됩니다. 1년 미만 근로자 또는 1년간 80% 미만 출근한 근로자에게는 1개월 개근 시 1일의 유급휴가가 부여됩니다. 사용자는 근로자의 연차 사용을 촉진할 의무가 있습니다.</p>
            </div>
        </section>

        <!-- Wages Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제7조 (임금)
            </h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>월 기본급</strong></td>
                            <td>${form.salaryType === 'hourly' ? (form.hourlyWage ? `${Number(form.hourlyWage).toLocaleString()}원/시간` : '[0,000]원/시간') : baseSalary + '원'}</td>
                        </tr>
                        <tr>
                            <td><strong>제수당</strong></td>
                            <td>${allowancesText}원 (식대, 교통비, 복리후생비)</td>
                        </tr>
                        <tr>
                            <td><strong>총 월 임금</strong></td>
                            <td>${totalSalary}원 (세전)</td>
                        </tr>
                        ${form.salaryType === 'hourly' && hourlyWage > 0 ? `
                        <tr>
                            <td><strong>시급제 계산 내역</strong></td>
                            <td>
                                <p>• 기본급: ${hourlyWage.toLocaleString()}원 × ${Math.round(workStats3.totalMonth / 60)}시간 = ${Math.round(calculatedMonthlySalary).toLocaleString()}원</p>
                                <p>• 연장수당: ${hourlyWage.toLocaleString()}원 × 0.5 × ${Math.round(workStats3.over / 60)}시간 = ${Math.round(overtimePay).toLocaleString()}원</p>
                                <p>• 야간수당: ${hourlyWage.toLocaleString()}원 × 0.5 × ${Math.round(workStats3.night / 60)}시간 = ${Math.round(nightPay).toLocaleString()}원</p>
                                <p>• 주휴수당: ${hourlyWage.toLocaleString()}원 × 8시간 × 4.345주 = ${Math.round(monthlyHolidayPay).toLocaleString()}원</p>
                                <p>• 제수당: ${allowancesText}원</p>
                            </td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td><strong>임금 지급일</strong></td>
                            <td>${form.payday || '매월 25일'}</td>
                        </tr>
                        <tr>
                            <td><strong>지급 방법</strong></td>
                            <td>${form.paymentMethod || '을의 지정 계좌로 입금'}</td>
                        </tr>
                        <tr>
                            <td><strong>임금 계산 기간</strong></td>
                            <td>매월 1일부터 말일까지</td>
                        </tr>
                        ${form.probationPeriod ? `
                        <tr style="background-color: #fef3c7;">
                            <td><strong>수습기간 임금</strong></td>
                            <td>
                                <div style="color: #92400e; font-size: 14px;">
                                    <p><strong>수습기간:</strong> ${form.probationPeriod}</p>
                                    <p><strong>정상 임금:</strong> ${totalSalaryForProbation.toLocaleString()}원</p>
                                    <p><strong>수습기간 임금:</strong> ${probationSalary.toLocaleString()}원</p>
                                    ${isMinimumApplied ? 
                                        `<p style="color: #dc2626; font-weight: bold;">최저임금 90% 보장으로 인해 ${form.probationDiscount}% 감액이 적용되지 않음</p>` : 
                                        `<p><strong>감액률:</strong> ${form.probationDiscount}%</p>`
                                    }
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 임금 지급의 원칙</p>
                <p>임금은 근로기준법 제43조에 따라 매월 1회 이상 일정한 날짜에 통화로 직접 근로자에게 그 전액을 지급해야 합니다. 임금은 최저임금법에 따른 최저임금 이상이어야 하며, 사용자는 임금명세서를 근로자에게 교부해야 할 의무가 있습니다 (근로기준법 제48조).</p>
                <p>법정 수당(연장, 야간, 휴일근로수당, 주휴수당 등)은 기본급과 별도로 가산하여 지급됩니다.</p>
                <p><strong>2025년 최저임금:</strong> 시급 ${LEGAL_INFO.MIN_WAGE.toLocaleString()}원, 월급 ${LEGAL_INFO.MIN_MONTHLY.toLocaleString()}원 (209시간 기준)</p>
                
                ${form.probationPeriod ? `
                <div class="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p class="font-semibold mb-2 text-yellow-800">■ 수습기간 임금 안내</p>
                    <p class="text-yellow-700 text-sm mb-2"><strong>수습기간:</strong> ${form.probationPeriod}</p>
                    <p class="text-yellow-700 text-sm mb-2"><strong>수습기간 임금:</strong> ${probationSalary.toLocaleString()}원 (정상 임금: ${totalSalaryForProbation.toLocaleString()}원)</p>
                    <p class="text-yellow-700 text-sm mb-2">• 수습기간 중에는 최저임금의 90% 이상을 지급할 수 있습니다 (근로기준법 제35조)</p>
                                        <p class="text-yellow-700 text-sm mb-2">• 단, 1년 이상 계속 근로하는 근로자에 대해서만 적용됩니다</p>
                    ${isMinimumApplied ? 
                        `<p class="text-yellow-700 text-sm" style="color: #dc2626; font-weight: bold;">• 최저임금 90% 보장으로 인해 ${form.probationDiscount}% 감액이 적용되지 않았습니다</p>` : 
                        `<p class="text-yellow-700 text-sm">• 적용된 감액률: ${form.probationDiscount}%</p>`
                    }
                </div>
                ` : ''}
            </div>
        </section>

        <!-- Social Insurance Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제8조 (사회보험)
            </h2>
            <p class="text-gray-700 leading-relaxed">
                갑과 을은 근로기준법 및 관련 법령에 따라 4대 사회보험 (국민연금, 건강보험, 고용보험, 산재보험)에 가입하며, 보험료는 관계 법령에 따라 갑과 을이 각각 부담한다.
            </p>
            
            <!-- 4대보험료 상세 정보 -->
            <div class="mt-6 overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg">4대보험료 정보 (2025년 기준)</th>
                            <th>근로자 부담</th>
                            <th>사업주 부담</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>국민연금 (4.5%)</strong></td>
                            <td>${Math.round(insurance.nationalPension/2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.nationalPension/2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>건강보험 (3.545%)</strong></td>
                            <td>${Math.round(insurance.healthInsurance/2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.healthInsurance/2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>장기요양보험 (0.4591%)</strong></td>
                            <td>${Math.round(insurance.longTermCare/2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.longTermCare/2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>고용보험 (0.9%)</strong></td>
                            <td>${Math.round(insurance.employmentInsurance/2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.employmentInsurance/2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>산재보험 (1.47%)</strong></td>
                            <td>0원</td>
                            <td>${Math.round(insurance.industrialAccident).toLocaleString()}원</td>
                        </tr>
                        <tr class="bg-blue-50">
                            <td><strong>총 보험료</strong></td>
                            <td><strong>${Math.round(insurance.total - insurance.industrialAccident).toLocaleString()}원</strong></td>
                            <td><strong>${Math.round(insurance.total).toLocaleString()}원</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 4대 사회보험</p>
                <p>4대 사회보험은 근로자의 생활 안정과 복지 증진을 위한 필수적인 제도입니다. 국민연금, 건강보험, 고용보험은 근로자와 사용자가 보험료를 분담하며, 산재보험은 전액 사용자가 부담합니다. 각 보험의 가입 및 보험료 납부는 법적 의무 사항입니다.</p>
                <p><strong>2025년 4대보험료 요율:</strong> 국민연금 4.5%, 건강보험 3.545%, 장기요양보험 0.4591%, 고용보험 0.9%, 산재보험 업종별(평균 1.47%)</p>
            </div>
        </section>

        <!-- Termination of Employment Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제9조 (계약 해지)
            </h2>
            <p class="text-gray-700 leading-relaxed">
                본 계약은 다음 각 호의 사유 발생 시 해지될 수 있다.
            </p>
            <ul class="list-disc list-inside ml-4 text-gray-700">
                <li>${getTerminationText(form)}</li>
                <li>갑 또는 을이 본 계약 내용을 위반한 경우</li>
                <li>근로기준법 및 기타 관련 법령에 의거한 해고 또는 사직 사유가 발생한 경우</li>
                <li>갑의 사업 폐지, 경영상 필요 등 정당한 사유가 있는 경우 (30일 전 통지)</li>
                <li>갑 또는 을이 중대한 위반행위를 한 경우</li>
                <li>을의 사직 의사가 있는 경우, 원활한 업무 인수인계 위해 퇴직 예정 30일 전에 사용자에게 통보 주시기 바랍니다.</li> 
            </ul>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 유의사항: 계약 해지 및 해고</p>
                <p>사용자는 근로자를 정당한 이유 없이 해고할 수 없습니다 (근로기준법 제23조). 해고 시에는 적어도 30일 전에 예고해야 하며, 30일 전에 예고하지 아니하였을 때에는 30일분 이상의 통상임금을 지급해야 합니다 (해고예고수당, 근로기준법 제26조).</p>
                <p>근로자가 퇴직할 경우에도 회사에 충분한 인수인계 기간을 제공하기 위해 사직 의사를 미리 통보하는 것이 바람직합니다. 퇴직금은 1년 이상 계속 근로한 근로자에게 지급됩니다 (근로자퇴직급여 보장법 제8조).</p>
            </div>
        </section>

        <!-- Other Conditions Section -->
        <section class="mb-8">
            <h2 class="section-title">
                <span class="icon">■</span> 제10조 (기타 사항)
            </h2>
            <ul class="list-disc list-inside ml-4 text-gray-700">
                <li>본 계약서에 명시되지 않은 사항은 근로기준법 및 회사의 취업규칙에 따른다.</li>
                <li>을은 회사의 영업 비밀 및 기밀 사항을 외부에 누설하지 아니하며, 퇴직 후에도 이를 준수한다.</li>
                <li>본 계약은 ${form.contractCopies || 2}부를 작성하여 갑과 을이 각각 1부씩 보관한다.</li>
            </ul>
            <div class="note mt-6">
                <p class="font-semibold mb-2">■ 중요 안내: 취업규칙 및 비밀유지 의무</p>
                <p>취업규칙은 근로기준법 제93조에 따라 상시 10명 이상의 근로자를 사용하는 사용자가 작성하여 고용노동부장관에게 신고해야 하는 규칙으로, 근로조건에 대한 세부적인 사항을 정합니다. 근로계약서에 명시되지 않은 사항은 취업규칙을 따릅니다.</p>
                <p>영업 비밀 및 기밀 유지 의무는 근로자의 중요한 의무 중 하나입니다. 이는 「부정경쟁방지 및 영업비밀보호에 관한 법률」에 의해 보호되며, 위반 시 법적 책임을 질 수 있습니다.</p>
            </div>
        </section>

        <!-- Signature Section -->
        <section class="mt-12 text-center">
            <h2 class="section-title justify-center">
                <span class="icon">■</span> 계약 당사자 서명
            </h2>
            <p class="text-gray-600 mb-8">
                본 계약의 내용을 충분히 이해하고 동의하며, 상호 성실히 이행할 것을 약속합니다.
            </p>

            <div class="flex flex-col md:flex-row justify-around items-center space-y-8 md:space-y-0 md:space-x-12">
                <div class="w-full md:w-1/2 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
                    <p class="text-xl font-bold text-blue-700 mb-4">갑 (사용자)</p>
                    <p class="text-lg text-gray-800"><strong>회사명:</strong> ${form.storeName || '[회사명]'}</p>
                    <p class="text-lg text-gray-800 mb-6"><strong>대표자:</strong> ${form.owner || '[대표자명]'} (인)</p>
                    <div class="border-t-2 border-dashed border-gray-300 pt-4 text-gray-500 text-sm">
                        서명 또는 날인
                    </div>
                </div>

                <div class="w-full md:w-1/2 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
                    <p class="text-xl font-bold text-green-700 mb-4">을 (근로자)</p>
                    <p class="text-lg text-gray-800"><strong>성명:</strong> ${form.name || '[근로자명]'}</p>
                    <p class="text-lg text-gray-800"><strong>생년월일:</strong> ${form.birth || '[YYYY년 MM월 DD일]'}</p>
                    <p class="text-lg text-gray-800 mb-6"><strong>연락처:</strong> ${form.contact || '[휴대폰 번호]'}</p>
                    <div class="border-t-2 border-dashed border-gray-300 pt-4 text-gray-500 text-sm">
                        서명 또는 날인
                    </div>
                </div>
            </div>

            <p class="mt-12 text-gray-500 text-sm">
                계약 체결일: ${contractDate}
            </p>
        </section>

        <!-- Footer / Legal Disclaimer -->
        <footer class="mt-16 text-center text-gray-500 text-xs">
            <p>본 계약서는 근로기준법을 바탕으로 작성된 표준 양식이며, 개별 상황에 따라 추가 또는 수정이 필요할 수 있습니다.</p>
            <p>법률 전문가와 상담하여 최종 내용을 확정하시길 권장합니다.</p>
        </footer>
    </div>

    <!-- Print Button -->
    <div class="no-print fixed bottom-4 right-4">
        <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold transition-colors">
            인쇄하기
        </button>
    </div>
</body>
</html>`;

    // 파일명 생성 (근로자명_날짜_시간)
    const workerName = form.name || '근로자';
    const today = new Date();
    const dateStr = today.getFullYear().toString().slice(-2) + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    const timeStr = String(today.getHours()).padStart(2, '0') + 
                   String(today.getMinutes()).padStart(2, '0');
    const fileName = `근로계약서_${workerName}_${dateStr}_${timeStr}.html`;

    // HTML 파일을 Blob으로 생성하고 다운로드
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 다운로드 후 새 창에서 바로 열기
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
  };

  // 각 단계별 입력 폼
  const renderStep = () => {
    // 시급제 계산을 위한 변수들 (renderStep 함수 시작 부분에서 정의)
    const workStats3 = calcWorkStats(form);
    const hourlyWage = Number(form.hourlyWage) || 0;
    const allowances = Number(form.allowances) || 0;
    
    // 시급제 계산
    let calculatedMonthlySalary = 0, overtimePay = 0, nightPay = 0, monthlyHolidayPay = 0;
    let monthlyWorkHours = 0, overtimeHours = 0, nightHours = 0;
    let totalCalculatedSalary = 0;
    
    if (form.salaryType === 'hourly' && hourlyWage > 0) {
      monthlyWorkHours = workStats3.totalMonth;
      const weeklyWorkHours = workStats3.totalWeek;
      
      calculatedMonthlySalary = hourlyWage * (monthlyWorkHours / 60);
      overtimeHours = workStats3.over;
      overtimePay = hourlyWage * 0.5 * (overtimeHours / 60);
      nightHours = workStats3.night;
      nightPay = hourlyWage * 0.5 * (nightHours / 60);
      
      // 주휴수당 계산 (1주 15시간 이상 근로 시, 8시간 기준)
      let weeklyHolidayPay = 0;
      if (weeklyWorkHours >= 15) {
        weeklyHolidayPay = hourlyWage * 8; // 주휴수당은 8시간 기준
      }
      monthlyHolidayPay = weeklyHolidayPay * 4.345;
      
      // 시급제 총 임금 계산
      totalCalculatedSalary = calculatedMonthlySalary + overtimePay + nightPay + monthlyHolidayPay + allowances;
    }
    
    // 수습기간 임금 계산 (모든 단계에서 사용 가능하도록)
    const totalSalaryForProbation = form.salaryType === 'monthly' ? (Number(form.baseSalary) + allowances) : totalCalculatedSalary;
    const probationSalary = form.probationPeriod ? calculateProbationSalary(totalSalaryForProbation, form.probationDiscount) : 0;
    const probationDiscountRate = Number(form.probationDiscount) / 100;
    const originalDiscountedSalary = totalSalaryForProbation * (1 - probationDiscountRate);
    const isMinimumApplied = probationSalary > originalDiscountedSalary;
    
    switch (step) {
      case 0: // 사업장 정보
        return (
          <div className="step-container">
            {/* 안내문구 강조 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>사업장의 정확한 정보를 입력해주세요. 이 정보는 근로계약서의 당사자 정보로 사용되며, 법적 분쟁 시 중요한 근거가 됩니다.</p>
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 실무 팁</p>
                <p className="guide-tip-text">• 사업장명은 사업자등록증에 기재된 명칭과 일치해야 합니다<br/>• 대표자명은 법인등기부등본 또는 사업자등록증을 확인하세요<br/>• 주소는 도로명주소를 사용하는 것이 좋습니다</p>
              </div>
            </div>
            {/* 입력 필드 예시: 필수 * 표시, 미입력 시 경고 */}
            <div className="form-group">
              <label className="form-label">사업장명 <span style={{color: 'red'}}>*</span></label>
              <input 
                name="storeName" 
                value={form.storeName} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="예: OO카페, OO식당" 
                style={{borderColor: !form.storeName ? 'red' : undefined}}
              />
              {!form.storeName && <p style={{color: 'red', fontWeight: 'bold'}}>사업장명은 필수 입력 항목입니다.</p>}
              <p className="form-help">사업장의 정식 명칭을 입력해주세요</p>
            </div>

            <div className="form-group">
              <label className="form-label">대표자명</label>
              <input 
                name="owner" 
                value={form.owner} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="대표자 성명" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">사업장 주소</label>
              <div className="address-input-group">
                <input 
                  name="address" 
                  value={form.address} 
                  onChange={handleChange} 
                  className="form-input address-main" 
                  placeholder="도로명 주소" 
                />
                <button 
                  type="button" 
                  onClick={handleAddressSearch} 
                  className="address-search-btn"
                >
                  주소찾기
                </button>
              </div>
              <input 
                name="addressDetail" 
                value={form.addressDetail} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="상세주소 (건물명, 층수 등)" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">사업장 연락처</label>
              <input 
                name="storeContact" 
                value={form.storeContact} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="02-0000-0000" 
              />
            </div>
          </div>
        );

      case 1: // 근로자 정보
        return (
          <div className="step-container">
            {/* 안내문구 강조 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>근로자의 개인정보를 정확히 입력해주세요. 주민등록상의 정보와 일치해야 하며, 개인정보보호법에 따라 안전하게 관리됩니다.</p>
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 법적 요건</p>
                <p className="guide-tip-text">• 근로기준법 제17조: 근로계약서에는 근로자의 성명이 포함되어야 합니다<br/>• 만 18세 미만자는 보호자 동의가 필요할 수 있습니다<br/>• 주민등록번호는 선택사항이며, 생년월일만으로도 충분합니다</p>
              </div>
            </div>
            {/* 입력 필드 예시: 필수 * 표시, 미입력 시 경고 */}
            <div className="form-group">
              <label className="form-label">근로자 성명 <span style={{color: 'red'}}>*</span></label>
              <input 
                name="name" 
                value={form.name} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="성명" 
                style={{borderColor: !form.name ? 'red' : undefined}}
              />
              {!form.name && <p style={{color: 'red', fontWeight: 'bold'}}>근로자 성명은 필수 입력 항목입니다.</p>}
            </div>

            <div className="form-group">
              <label className="form-label">생년월일</label>
              <input 
                name="birth" 
                type="date" 
                value={form.birth} 
                onChange={handleChange} 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">근로자 주소</label>
              <div className="address-input-group">
                <input 
                  name="workerAddress" 
                  value={form.workerAddress} 
                  onChange={handleChange} 
                  className="form-input address-main" 
                  placeholder="도로명 주소" 
                />
                <button 
                  type="button" 
                  onClick={() => {
                    if (window.daum && window.daum.Postcode) {
                      new window.daum.Postcode({
                        oncomplete: function(data) {
                          setForm(prev => ({
                            ...prev,
                            workerAddress: data.address,
                            workerAddressDetail: ''
                          }));
                        }
                      }).open();
                    } else {
                      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                    }
                  }} 
                  className="address-search-btn"
                >
                  주소찾기
                </button>
              </div>
              <input 
                name="workerAddressDetail" 
                value={form.workerAddressDetail} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="상세주소 (건물명, 층수 등)" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">연락처</label>
              <input 
                name="contact" 
                value={form.contact} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="010-0000-0000" 
              />
              <p className="form-help">휴대폰 번호를 입력해주세요</p>
            </div>
          </div>
        );

      case 2: // 계약 기간
        return (
          <div className="step-container">
            {/* 안내문구 강조 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>근로계약의 기간을 명확히 설정해주세요. 기간제 계약과 무기한 계약의 법적 효과가 다르므로 신중히 결정하세요.</p>
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 법적 기준</p>
                <ul className="guide-tip-text" style={{margin: 0, paddingLeft: 18, listStyle: 'disc'}}>
                  <li>계약 종료일을 비워두면 무기한 계약이 됩니다</li>
                  <li>기간제 근로자 보호법: 2년 초과 기간제 계약은 무기한 계약으로 전환</li>
                </ul>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">계약 시작일 <span style={{color: 'red'}}>*</span></label>
              <input 
                name="periodStart" 
                type="date" 
                value={form.periodStart} 
                onChange={handleChange} 
                className="form-input" 
                style={{borderColor: !form.periodStart ? 'red' : undefined}}
              />
              {!form.periodStart && <p style={{color: 'red', fontWeight: 'bold'}}>계약 시작일은 필수 입력 항목입니다.</p>}
            </div>

            <div className="form-group">
              <label className="form-label">계약 종료일</label>
              <input 
                name="periodEnd" 
                type="date" 
                value={form.periodEnd} 
                onChange={handleChange} 
                className="form-input" 
              />
              <p className="form-help">기간제 계약의 경우 종료일을, 무기한 계약의 경우 비워두세요</p>
            </div>


          </div>
        );

      case 3: // 근무 조건
        return (
          <div className="step-container">
            {/* 작성 가이드: 파란색 박스 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>근무 장소와 업무 내용을 구체적으로 명시해주세요. 이는 근로자의 권리와 의무를 명확히 하고, 추후 업무 범위 변경 시 참고 자료가 됩니다.</p>
              {/* 실무 팁: 회색 박스 */}
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e', marginTop: 8}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', color: '#334155', marginBottom: 2}}>💡 실무 팁</p>
                <p className="guide-tip-text">• 근무장소는 구체적인 주소나 건물명을 명시하세요<br/>• 업무내용은 담당 업무의 핵심을 간단명료하게 작성하세요<br/>• 직책은 회사 내 조직도에 맞는 명칭을 사용하세요</p>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">근무 장소</label>
              <input 
                name="workLocation" 
                value={form.workLocation} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="근무할 장소 (예: 본사, 지점 등)" 
              />
              <p className="form-help">기본적으로 사업장 주소와 동일하지만, 별도 지정 장소가 있다면 입력해주세요</p>
            </div>

            <div className="form-group">
              <label className="form-label">업무 내용</label>
              <input 
                name="jobDesc" 
                value={form.jobDesc} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="예: 웹 개발, 영업, 사무 지원, 주방 보조 등" 
              />
              <p className="form-help">담당할 업무를 구체적으로 입력해주세요</p>
            </div>

            <div className="form-group">
              <label className="form-label">직위/직책</label>
              <input 
                name="position" 
                value={form.position} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="예: 사원, 대리, 과장, 주임 등" 
              />
            </div>
          </div>
        );

      case 4: // 근로시간
        return (
          <div className="step-container">
            {/* 작성 가이드: 파란색 박스 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>근로시간은 근로기준법의 핵심 규정입니다. 법정 근로시간을 준수하고, 연장근로와 휴게시간을 정확히 설정해주세요.</p>
              {/* 법적 기준: 회색 박스 */}
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e', marginTop: 8}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', color: '#334155', marginBottom: 2}}>💡 법적 기준</p>
                <p className="guide-tip-text">• 1일 8시간, 1주 40시간이 기본 근로시간입니다<br/>• 1일 8시간 초과는 연장근로로 50% 가산 지급<br/>• 22:00~06:00 근무는 야간근로로 50% 가산 지급<br/>• 휴게시간은 근로기준법에 따라 자동 계산됩니다 (4시간 초과 시 30분, 8시간 초과 시 1시간)</p>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">근무 요일</label>
              <div className="day-selector">
                {daysOfWeek.map((day) => (
                  <label key={day} className={`day-option ${form.days.includes(day) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      name="days"
                      value={day}
                      checked={form.days.includes(day)}
                      onChange={handleChange}
                      className="day-checkbox"
                    />
                    <span className="day-text">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <div className="time-type-selector">
                <button 
                  type="button" 
                  onClick={() => setForm(f => ({ ...f, workTimeType: 'same', dayTimes: {} }))} 
                  className={`time-type-btn ${form.workTimeType === 'same' ? 'active' : ''}`}
                >
                  매일 같다
                </button>
                <button 
                  type="button" 
                  onClick={() => setForm(f => ({ ...f, workTimeType: 'diff', commonStart: '', commonEnd: '', commonBreak: '' }))} 
                  className={`time-type-btn ${form.workTimeType === 'diff' ? 'active' : ''}`}
                >
                  요일마다 다르다
                </button>
              </div>
            </div>

            {form.workTimeType === 'same' && (
              <>
                <div className="form-group">
                  <label className="form-label">출근 시간</label>
                  <input 
                    name="commonStart" 
                    type="time" 
                    value={form.commonStart} 
                    onChange={handleChange} 
                    className="form-input" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">퇴근 시간</label>
                  <input 
                    name="commonEnd" 
                    type="time" 
                    value={form.commonEnd} 
                    onChange={handleChange} 
                    className="form-input" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">휴게시간 (분)</label>
                  <input 
                    name="commonBreak" 
                    type="number" 
                    value={form.commonBreak} 
                    onChange={handleChange} 
                    className="form-input" 
                    min={0} 
                    placeholder="60" 
                  />
                </div>
              </>
            )}

            {form.workTimeType === 'diff' && (
              <div className="form-group">
                <label className="form-label">요일별 근무시간</label>
                <div className="day-times">
                  {form.days.map((day) => (
                    <div key={day} className="day-time-item">
                      <div className="day-time-header">
                        <span className="day-time-day">{day}</span>
                        <span className="day-time-summary">
                          {getBtnTime(day, form) ? `근무시간: ${getBtnTime(day, form)}` : '근무시간: -'}
                        </span>
                      </div>
                      <div className="day-time-inputs">
                        <input
                          type="time"
                          name="dayStart"
                          data-day={day}
                          value={form.dayTimes[day]?.start || ''}
                          onChange={handleChange}
                          className="form-input time-input"
                          placeholder="출근"
                        />
                        <span className="time-separator">~</span>
                        <input
                          type="time"
                          name="dayEnd"
                          data-day={day}
                          value={form.dayTimes[day]?.end || ''}
                          onChange={handleChange}
                          className="form-input time-input"
                          placeholder="퇴근"
                        />
                        <div className="break-display">
                          <span className="break-label">휴게:</span>
                          <span className="break-value">
                            {form.dayTimes[day]?.start && form.dayTimes[day]?.end 
                              ? `${form.dayTimes[day]?.break || calculateBreakTime(form.dayTimes[day].start, form.dayTimes[day].end)}분`
                              : '-'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.workTimeType && (
              <div className="work-summary">
                <WorkTimeSummary form={form} />
                <OvertimeWarning form={form} />
              </div>
            )}
          </div>
        );

      case 5: // 임금
        return (
          <div className="step-container">
            {/* 안내문구 강조 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>최저임금을 준수하여 임금을 설정해주세요. 시급제와 월급제의 계산 방식이 다르므로 신중히 선택하세요.</p>
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 법적 기준</p>
                <p className="guide-tip-text">• 2025년 최저임금: 10,030원/시간 (월 2,096,270원)<br/>• 주휴수당: 1주 15시간 이상 근로 시 시급×8시간×4.345주<br/>• 연장수당: 시급×0.5×연장시간, 야간수당: 시급×0.5×야간시간</p>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">임금 형태 <span style={{color: 'red'}}>*</span></label>
              <div className="radio-group" style={{display: 'flex', gap: 16}}>
                <label className="radio-label" style={{display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                  <input 
                    type="radio" 
                    name="salaryType" 
                    value="monthly" 
                    checked={form.salaryType === 'monthly'} 
                    onChange={handleChange} 
                    style={{margin: 0}}
                  />
                  <span>월급제</span>
                </label>
                <label className="radio-label" style={{display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                  <input 
                    type="radio" 
                    name="salaryType" 
                    value="hourly" 
                    checked={form.salaryType === 'hourly'} 
                    onChange={handleChange} 
                    style={{margin: 0}}
                  />
                  <span>시급제</span>
                </label>
              </div>
              {!form.salaryType && <p style={{color: 'red', fontWeight: 'bold'}}>임금 형태는 필수 선택 항목입니다.</p>}
            </div>

            {form.salaryType === 'monthly' && (
                <div className="form-group">
                <label className="form-label">월 기본급 <span style={{color: 'red'}}>*</span></label>
                  <input 
                  name="monthlySalary" 
                    type="number" 
                  value={form.monthlySalary} 
                    onChange={handleChange} 
                    className="form-input" 
                  placeholder="예: 2500000"
                  style={{borderColor: !form.monthlySalary ? 'red' : undefined}}
                />
                {!form.monthlySalary && <p style={{color: 'red', fontWeight: 'bold'}}>월 기본급은 필수 입력 항목입니다.</p>}
                <p className="form-help">최저임금(2,096,270원) 이상으로 설정해주세요</p>
                
                {/* 월급제 법적 기준 안내 */}
                {form.monthlySalary && <MonthlyWageLegalGuide form={form} />}
                </div>
            )}

            {form.salaryType === 'hourly' && (
                <div className="form-group">
                <label className="form-label">시급 <span style={{color: 'red'}}>*</span></label>
                  <input 
                    name="hourlyWage" 
                    type="number" 
                    value={form.hourlyWage} 
                    onChange={handleChange} 
                    className="form-input" 
                  placeholder="예: 12000"
                  style={{borderColor: !form.hourlyWage ? 'red' : undefined}}
                />
                {!form.hourlyWage && <p style={{color: 'red', fontWeight: 'bold'}}>시급은 필수 입력 항목입니다.</p>}
                <p className="form-help">최저임금(10,030원/시간) 이상으로 설정해주세요</p>
                
                {/* 시급제 법적 기준 안내 */}
                {form.hourlyWage && <HourlyWageLegalGuide form={form} />}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">제수당</label>
              <input 
                name="allowances" 
                type="number" 
                value={form.allowances} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="예: 200000"
              />
              <p className="form-help">식대, 교통비, 복리후생비 등 (선택사항)</p>
            </div>
          </div>
        );

      case 6: // 수습기간 설정
        return (
          <div className="step-container">
            {/* 작성 가이드: 파란색 박스 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>수습기간은 근로자의 업무 적응 및 능력 평가를 위한 기간입니다. 1년 이상 계약에서만 설정 가능하며, 최저임금의 90% 이상을 보장합니다.</p>
              {/* 법적 기준: 회색 박스 (파란 박스 내부로 이동) */}
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e', marginBottom: 0, marginTop: 8}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', color: '#334155', marginBottom: 2}}>💡 법적 기준</p>
                <ul className="guide-tip-text" style={{margin: 0, paddingLeft: 18, listStyle: 'disc'}}>
                  <li>수습기간은 최대 3개월까지 가능 (근로기준법 제35조)</li>
                  <li>1년 이상 계약 또는 무기한 계약에서만 설정 가능</li>
                  <li>수습기간 중 최저임금의 90% 이상 지급 가능</li>
                  <li>수습기간 중에도 정당한 이유 없는 해고는 부당해고</li>
                </ul>
              </div>
            </div>
            
            {/* 수습기간 불가 안내문 */}
            {(() => {
              // 계약 기간 계산
              const startDate = new Date(form.periodStart);
              const endDate = form.periodEnd ? new Date(form.periodEnd) : null;
              const isIndefinite = !form.periodEnd; // 무기한 계약
              let isOneYearOrMore = false;
              if (endDate) {
                const diffTime = endDate - startDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                isOneYearOrMore = diffDays >= 365;
              }
              const isEligible = isIndefinite || isOneYearOrMore;
              
              if (!isEligible) {
                return (
                  <div style={{
                    background: '#e0f2fe',
                    borderLeft: '5px solid #2563eb',
                    borderRadius: 8,
                    padding: 16,
                    color: '#d97706',
                    fontSize: '15px',
                    marginBottom: 16
                  }}>
                    현재 근로계약기간이 1년 미만이라 수습기간을 정할 수 없습니다. 계약 기간을 1년 이상으로 변경하거나 무기한 계약으로 설정하면 수습기간을 입력할 수 있습니다.
                    {endDate && (
                      <div style={{ marginTop: 8, color: '#d97706', fontSize: '14px' }}>
                        현재 근로계약기간: {Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))}일
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
            
            
            {(() => {
              // 계약 기간 계산
              const startDate = new Date(form.periodStart);
              const endDate = form.periodEnd ? new Date(form.periodEnd) : null;
              const isIndefinite = !form.periodEnd; // 무기한 계약
              let isOneYearOrMore = false;
              if (endDate) {
                const diffTime = endDate - startDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                isOneYearOrMore = diffDays >= 365;
              }
              const isEligible = isIndefinite || isOneYearOrMore;
              if (!isEligible) {
                // 수습 불가 시 값 리셋
                if (form.probationPeriod || form.probationDiscount) {
                  setForm(prev => ({
                    ...prev,
                    probationPeriod: '',
                    probationDiscount: ''
                  }));
                }
                // 수습기간 불가 안내문은 이미 위에서 표시됨
                return null;
              }

              return (
                <>
                  <div className="form-group">
                    <label className="form-label">수습 기간</label>
                    <select 
                      name="probationPeriod" 
                      value={form.probationPeriod} 
                      onChange={handleChange} 
                      className="form-input"
                    >
                      <option value="">수습 기간 없음</option>
                      <option value="1개월">1개월</option>
                      <option value="2개월">2개월</option>
                      <option value="3개월">3개월</option>
                    </select>
                    <p className="form-help">수습기간을 설정하지 않으면 정상 임금이 지급됩니다</p>
                  </div>
                  
                  {/* 수습기간 감액률 선택 */}
                  {form.probationPeriod && (
                    <div className="form-group">
                      <label className="form-label">수습기간 임금 감액률</label>
                      <select 
                        name="probationDiscount" 
                        value={form.probationDiscount} 
                        onChange={handleChange} 
                        className="form-input"
                      >
                        <option value="10">10% 감액</option>
                        <option value="15">15% 감액</option>
                        <option value="20">20% 감액</option>
                        <option value="25">25% 감액</option>
                        <option value="30">30% 감액</option>
                      </select>
                      
                      {/* 수습기간 임금 계산 결과 표시 */}
                      <div style={{
                        marginTop: 8,
                        padding: 12,
                        backgroundColor: '#f0f9ff',
                        borderRadius: 6,
                        border: '1px solid #0ea5e9',
                        fontSize: '13px'
                      }}>
                        <p style={{margin: 0, fontWeight: 'bold', color: '#0c4a6e'}}>💰 수습기간 임금 계산:</p>
                        <ul style={{margin: '4px 0 0 0', paddingLeft: 16, color: '#0c4a6e'}}>
                          <li>정상 임금: {totalSalaryForProbation.toLocaleString()}원</li>
                          <li>{form.probationDiscount}% 감액 후: {originalDiscountedSalary.toLocaleString()}원</li>
                          <li>최종 수습기간 임금: <strong>{probationSalary.toLocaleString()}원</strong></li>
                          {isMinimumApplied && (
                            <li style={{color: '#dc2626', fontWeight: 'bold'}}>
                              ⚠️ 최저임금 90% 보장으로 인해 {form.probationDiscount}% 감액이 적용되지 않았습니다
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* 법적 안내 */}
                  {form.probationPeriod && (
                    <div style={{
                      marginTop: 16,
                      padding: 12,
                      backgroundColor: '#fef3c7',
                      borderRadius: 6,
                      border: '1px solid #f59e0b',
                      fontSize: '13px',
                      color: '#92400e'
                    }}>
                      <p style={{margin: 0, fontWeight: 'bold'}}>💡 수습기간 법적 안내:</p>
                      <ul style={{margin: '4px 0 0 0', paddingLeft: 16}}>
                        <li>1년 이상 근로계약시에만 설정 가능</li>
                        <li>담당 업무가 단순노무직은 수습기간 동안 감액을 할 수 없음</li>
                        <li>(청소원, 주방 보조, 배달원, 주유원, 식당 서빙 등)</li>
                        <li>수습기간 중에도 정당한 이유 없는 해고는 부당해고</li>
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        );

      case 7: // 기타 사항
        return (
          <div className="step-container">
            {/* 작성 가이드: 파란색 박스 */}
            <div className="guide-box" style={{background: '#e0f2fe', borderLeft: '5px solid #2563eb', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#2563eb', marginBottom: 4}}>📋 작성 가이드</p>
              <p className="guide-text" style={{marginBottom: 8}}>임금 지급일, 지급 방법, 기타 특별한 조건 등을 설정해주세요. 이는 계약의 구체적인 이행 방법을 명확히 합니다.</p>
              {/* 실무 팁: 회색 박스 */}
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 실무 팁</p>
                <p className="guide-tip-text">• 임금 지급일은 매월 정기적으로 설정하세요<br/>• 계좌이체를 권장하며, 현금 지급 시 영수증을 발급하세요<br/>• 기타 조건은 구체적이고 명확하게 작성하세요</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">임금 지급일 <span style={{color: 'red'}}>*</span></label>
              <select 
                name="payday" 
                value={form.payday} 
                onChange={handleChange} 
                className="form-input"
                style={{borderColor: !form.payday ? 'red' : undefined}}
              >
                <option value="">선택해주세요</option>
                <option value="매월 25일">매월 25일</option>
                <option value="매월 말일">매월 말일</option>
                <option value="매월 10일">매월 10일</option>
                <option value="매월 15일">매월 15일</option>
              </select>
              {!form.payday && <p style={{color: 'red', fontWeight: 'bold'}}>임금 지급일은 필수 선택 항목입니다.</p>}
            </div>

            <div className="form-group">
              <label className="form-label">지급 방법 <span style={{color: 'red'}}>*</span></label>
              <select 
                name="paymentMethod" 
                value={form.paymentMethod} 
                onChange={handleChange} 
                className="form-input"
                style={{borderColor: !form.paymentMethod ? 'red' : undefined}}
              >
                <option value="">선택해주세요</option>
                <option value="계좌이체">계좌이체</option>
                <option value="현금">현금</option>
                <option value="수표">수표</option>
              </select>
              {!form.paymentMethod && <p style={{color: 'red', fontWeight: 'bold'}}>지급 방법은 필수 선택 항목입니다.</p>}
            </div>
            
            <div className="form-group">
              <label className="form-label">기타 조건</label>
                  <textarea 
                name="otherConditions" 
                value={form.otherConditions} 
                    onChange={handleChange} 
                className="form-input" 
                rows="4"
                placeholder="예: 복리후생, 교육훈련, 비밀유지, 경업금지 등"
              />
              <p className="form-help">계약에 특별히 포함할 조건이 있다면 작성해주세요 (선택사항)</p>
            </div>
          </div>
        );

      case 8: // 최종 확인
        return (
          <div className="step-container">
            {/* 안내문구 강조 */}
            <div className="guide-box" style={{background: '#fef3c7', borderLeft: '5px solid #f59e0b', borderRadius: 8, padding: 16, marginBottom: 16}}>
              <p className="guide-title" style={{fontWeight: 'bold', color: '#f59e0b', marginBottom: 4}}>✅ 최종 확인</p>
              <p className="guide-text" style={{marginBottom: 8}}>입력하신 모든 정보를 다시 한 번 확인해주세요. 계약서 생성 후에는 수정이 어려우므로 꼼꼼히 점검하세요.</p>
              <div className="guide-tip" style={{background: '#f1f5f9', borderRadius: 6, padding: 10, color: '#0c4a6e'}}>
                <p className="guide-tip-title" style={{fontWeight: 'bold', marginBottom: 2}}>💡 확인 사항</p>
                <p className="guide-tip-text">• 모든 필수 항목이 입력되었는지 확인<br/>• 임금이 최저임금을 준수하는지 확인<br/>• 근로시간이 법적 기준을 준수하는지 확인<br/>• 계약서는 근로자와 사용자 각각 1부씩 보관</p>
              </div>
            </div>
            
            {/* 입력값 요약 표 */}
            <div className="summary-table-container" style={{marginBottom: 24}}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: 16, color: '#1f2937'}}>📋 입력값 요약</h3>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: '#ffffff'
              }}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <tbody>
                    {/* 사업장 정보 */}
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', width: '30%'}}>사업장 정보</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>사업장명:</strong> {form.storeName || '-'}</div>
                        <div><strong>대표자:</strong> {form.owner || '-'}</div>
                        <div><strong>주소:</strong> {form.address} {form.addressDetail}</div>
                        <div><strong>연락처:</strong> {form.storeContact || '-'}</div>
                      </td>
                    </tr>
                    
                    {/* 근로자 정보 */}
                    <tr>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>근로자 정보</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>성명:</strong> {form.name || '-'}</div>
                        <div><strong>생년월일:</strong> {form.birth || '-'}</div>
                        <div><strong>주소:</strong> {form.workerAddress} {form.workerAddressDetail}</div>
                        <div><strong>연락처:</strong> {form.contact || '-'}</div>
                      </td>
                    </tr>
                    
                    {/* 계약 기간 */}
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>계약 기간</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>시작일:</strong> {form.periodStart || '-'}</div>
                        <div><strong>종료일:</strong> {form.periodEnd || '무기한'}</div>
                        <div><strong>수습기간:</strong> {form.probationPeriod || '-'}</div>
                      </td>
                    </tr>
                    
                    {/* 근무 조건 */}
                    <tr>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>근무 조건</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>근무장소:</strong> {form.workLocation || '-'}</div>
                        <div><strong>업무내용:</strong> {form.jobDesc || '-'}</div>
                        <div><strong>직책:</strong> {form.position || '-'}</div>
                      </td>
                    </tr>
                    
                    {/* 근로시간 */}
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>근로시간</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>근무일:</strong> {form.days.join(', ')}</div>
                        {form.workTimeType === 'same' ? (
                          <>
                            <div><strong>근무시간:</strong> {form.commonStart} ~ {form.commonEnd}</div>
                            <div><strong>휴게시간:</strong> {form.commonBreak}분</div>
                    </>
                  ) : (
                          <div><strong>근무시간:</strong> 요일별 상이</div>
                        )}
                      </td>
                    </tr>
                    
                    {/* 임금 조건 */}
                    <tr>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>임금 조건</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>임금 형태:</strong> {form.salaryType === 'monthly' ? '월급제' : '시급제'}</div>
                        {form.salaryType === 'monthly' ? (
                          <div><strong>월 기본급:</strong> {Number(form.baseSalary).toLocaleString()}원</div>
                        ) : (
                          <div><strong>시급:</strong> {Number(form.hourlyWage).toLocaleString()}원</div>
                        )}
                        <div><strong>제수당:</strong> {Number(form.allowances).toLocaleString()}원</div>
                        <div><strong>지급일:</strong> {form.payday || '-'}</div>
                        <div><strong>지급방법:</strong> {form.paymentMethod || '-'}</div>
                      </td>
                    </tr>
                    
                    {/*  */}
                    {form.probationPeriod && (
                      <tr style={{backgroundColor: '#fef3c7'}}>
                        <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}></td>
                        <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                          <div><strong>수습기간:</strong> {form.probationPeriod}</div>
                          <div><strong>정상 임금:</strong> {totalSalaryForProbation.toLocaleString()}원</div>
                          <div><strong>수습기간 임금:</strong> {probationSalary.toLocaleString()}원</div>
                          {isMinimumApplied ? (
                            <div style={{color: '#dc2626', fontWeight: 'bold'}}>
                              ⚠️ 최저임금 90% 보장으로 인해 {form.probationDiscount}% 감액이 적용되지 않음
                            </div>
                          ) : (
                            <div><strong>감액률:</strong> {form.probationDiscount}%</div>
                          )}
                        </td>
                      </tr>
                    )}
                    
                    {/* 기타 사항 */}
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <td style={{padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb'}}>기타 사항</td>
                      <td style={{padding: '12px 16px', borderBottom: '1px solid #e5e7eb'}}>
                        <div><strong>4대보험:</strong> {form.socialInsurance ? '가입' : '미가입'}</div>
                        <div><strong>기타 조건:</strong> {form.otherConditions || '-'}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 근로계약서 다운로드 버튼 */}
            <div className="download-section" style={{textAlign: 'center', marginTop: 32}}>
              <button 
                onClick={async () => {
                  try {
                    // 먼저 근로계약서 페이지를 새 탭에서 열기
                    window.open('/contract-download', '_blank');
                    
                    // 백그라운드에서 PDF 다운로드 진행
                    setTimeout(async () => {
                      try {
                        await handleSavePDF();
                      } catch (error) {
                        console.error('PDF 생성 중 오류:', error);
                        // 사용자에게 오류 알림 (선택사항)
                      }
                    }, 1000); // 1초 후 다운로드 시작
                  } catch (error) {
                    console.error('페이지 열기 중 오류:', error);
                    alert('페이지 열기 중 오류가 발생했습니다. 다시 시도해주세요.');
                  }
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '16px 32px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#1d4ed8';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#2563eb';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
              >
                📄 근로계약서 보기 및 다운로드
              </button>
              <p style={{
                marginTop: 12,
                fontSize: '14px',
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                근로계약서 페이지가 열리고 PDF가 자동으로 다운로드됩니다
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="contract-form-page">
      <div className="contract-form-container">
        {/* Header */}
        <div className="form-header">
          <button onClick={() => navigate('/')} className="back-btn">
            ← 홈으로
          </button>
          <h1 className="form-title">표준근로계약서 작성</h1>
          <div className="header-spacer"></div>
        </div>
        
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {step + 1} / {steps.length}
          </div>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {steps.map((stepName, index) => (
            <div key={index} className={`step-dot ${index <= step ? 'active' : ''} ${index === step ? 'current' : ''}`}>
              <span className="step-number">{index + 1}</span>
              <span className="step-name">{stepName}</span>
            </div>
          ))}
        </div>
        
        {/* Step Content */}
        <div className="step-content">
          {renderStep()}
        </div>
        
        {/* Navigation Buttons */}
        <div className="navigation-buttons">
          <button 
            onClick={() => setStep(Math.max(0, step - 1))} 
            className={`nav-btn prev-btn ${step === 0 ? 'hidden' : ''}`}
          >
            ← 이전
          </button>
          <button 
            onClick={() => setStep(Math.min(steps.length - 1, step + 1))} 
            className={`nav-btn next-btn ${step === steps.length - 1 ? 'hidden' : ''}`}
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 휴게시간 자동 계산 함수 (근로기준법 제54조)
function calculateBreakTime(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  
  const start = getMinutes(startTime);
  const end = getMinutes(endTime);
  let workMinutes = end > start ? end - start : (end + 24 * 60) - start;
  
  // 근로기준법 제54조: 4시간 초과 시 30분, 8시간 초과 시 1시간 휴게
  if (workMinutes <= 4 * 60) {
    return 0; // 4시간 이하: 휴게 없음
  } else if (workMinutes <= 8 * 60) {
    return 30; // 4시간 초과 ~ 8시간 이하: 30분 휴게
  } else {
    return 60; // 8시간 초과: 1시간 휴게
  }
}

// 4대보험 가입 조건 판단 함수
function checkInsuranceEligibility(weekWorkHours, monthWorkHours) {
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
function checkWeeklyHolidayEligibility(weekWorkHours) {
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

// 월급제 법적 최소 임금 계산 함수
function calculateMinimumMonthlyWage(form) {
  const workStats = calcWorkStats(form);
  const monthlyWorkHours = workStats.totalMonth / 60; // 분을 시간으로 변환
  const weeklyWorkHours = workStats.totalWeek / 60; // 분을 시간으로 변환
  
  // 기본 최저임금 (월간 근무시간 × 최저시급)
  const basicMinimumWage = monthlyWorkHours * LEGAL_INFO.MIN_WAGE;
  
  // 주휴수당 계산 (1주 15시간 이상 근로 시)
  let weeklyHolidayPay = 0;
  if (weeklyWorkHours >= 15) {
    // 주 40시간 초과분에 대한 주휴수당
    const weeklyOvertime = Math.max(0, weeklyWorkHours - 40);
    const weeklyHolidayPayPerWeek = weeklyOvertime * LEGAL_INFO.MIN_WAGE;
    weeklyHolidayPay = weeklyHolidayPayPerWeek * 4.345; // 월평균 4.345주
  }
  
  // 연장근로수당 계산
  const overtimeHours = workStats.over / 60; // 분을 시간으로 변환
  const overtimePay = overtimeHours * LEGAL_INFO.MIN_WAGE * 0.5; // 50% 가산
  
  // 야간근로수당 계산
  const nightHours = workStats.night / 60; // 분을 시간으로 변환
  const nightPay = nightHours * LEGAL_INFO.MIN_WAGE * 0.5; // 50% 가산
  
  // 총 법적 최소 임금
  const totalMinimumWage = basicMinimumWage + weeklyHolidayPay + overtimePay + nightPay;
  
  return {
    basicMinimumWage: Math.round(basicMinimumWage),
    weeklyHolidayPay: Math.round(weeklyHolidayPay),
    overtimePay: Math.round(overtimePay),
    nightPay: Math.round(nightPay),
    totalMinimumWage: Math.round(totalMinimumWage),
    monthlyWorkHours: Math.round(monthlyWorkHours * 10) / 10,
    weeklyWorkHours: Math.round(weeklyWorkHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    nightHours: Math.round(nightHours * 10) / 10
  };
}

// 연장근로 경고 컴포넌트
function OvertimeWarning({ form }) {
  const workStats = calcWorkStats(form);
  const weeklyOvertimeHours = workStats.over / 60; // 분을 시간으로 변환
  
  if (weeklyOvertimeHours > 12) {
    return (
      <div style={{
        marginTop: 16,
        padding: 16,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        border: '2px solid #dc2626'
      }}>
        <h4 style={{
          margin: '0 0 12px 0',
          color: '#dc2626',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          ■ 연장근로 한도 초과 경고
        </h4>
        <p style={{
          margin: '0 0 8px 0',
          color: '#7f1d1d',
          fontSize: '14px'
        }}>
          현재 설정된 연장근로 시간이 주 12시간 한도를 초과합니다.
        </p>
        <div style={{
          marginTop: 8,
          padding: 8,
          backgroundColor: '#fee2e2',
          borderRadius: 4,
          fontSize: '13px'
        }}>
          <p style={{margin: '0 0 4px 0', fontWeight: 'bold'}}>현재 설정:</p>
          <p style={{margin: 0}}>• 주간 연장근로: {Math.round(weeklyOvertimeHours * 10) / 10}시간</p>
          <p style={{margin: 0}}>• 법적 한도: 12시간</p>
          <p style={{margin: '8px 0 0 0', fontWeight: 'bold', color: '#dc2626'}}>
            근로기준법 제53조에 따라 주 12시간을 초과하는 연장근로는 불법입니다.
          </p>
        </div>
      </div>
    );
  }
  
  return null;
}

// 근무시간 안내 컴포넌트 분리
function WorkTimeSummary({ form }) {
  const workStats = calcWorkStats(form);
  const weekWorkHours = workStats.totalWeek / 60; // 분을 시간으로 변환
  const monthWorkHours = workStats.totalMonth / 60; // 분을 시간으로 변환
  
  const insurance = checkInsuranceEligibility(weekWorkHours, monthWorkHours);
  const weeklyHoliday = checkWeeklyHolidayEligibility(weekWorkHours);
  
  return (
    <div className="work-time-summary">
      <h3 className="summary-title">근무시간 요약</h3>
      <div className="summary-content">
        <div className="summary-item">
          <span className="summary-label">주당 근무시간:</span>
          <span className="summary-value">{getHourStr(workStats.totalWeek)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">월간 근무시간(예상):</span>
          <span className="summary-value">{getHourStr(workStats.totalMonth)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">야간근로(22:00~06:00):</span>
          <span className="summary-value">{getHourStr(workStats.night)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">연장근로(1일 8시간 초과):</span>
          <span className="summary-value">{getHourStr(workStats.over)}</span>
        </div>
      </div>
      <p className="summary-note">※ 월평균 4.345주 기준으로 계산됩니다</p>
      
      {/* 4대보험 및 주휴수당 대상 여부 안내 */}
      <div className="legal-status-section">
        <h4 className="legal-status-title">■ 법적 기준 안내</h4>
        <div className="legal-status-content">
          <div className={`legal-status-item ${insurance.isEligible ? 'eligible' : 'not-eligible'}`}>
            <div className="status-icon">
              {insurance.isEligible ? '■' : '□'}
            </div>
            <div className="status-content">
              <div className="status-label">4대보험 의무가입</div>
              <div className="status-description">{insurance.reason}</div>
              <div className="status-detail">
                기준: 주 15시간 이상 또는 월 60시간 이상
              </div>
            </div>
          </div>
          
          <div className={`legal-status-item ${weeklyHoliday.isEligible ? 'eligible' : 'not-eligible'}`}>
            <div className="status-icon">
              {weeklyHoliday.isEligible ? '■' : '□'}
            </div>
            <div className="status-content">
              <div className="status-label">주휴수당 대상</div>
              <div className="status-description">{weeklyHoliday.reason}</div>
              <div className="status-detail">
                기준: 1주 15시간 이상 근로
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 월급제 법적 기준 안내 컴포넌트
function MonthlyWageLegalGuide({ form }) {
  if (form.salaryType !== 'monthly' || !form.monthlySalary) {
    return null;
  }
  
  const minimumWage = calculateMinimumMonthlyWage(form);
  const inputWage = Number(form.monthlySalary) || 0;
  const allowances = Number(form.allowances) || 0;
  const totalInputWage = inputWage + allowances;
  const isCompliant = totalInputWage >= minimumWage.totalMinimumWage;
  
  return (
    <div className={`monthly-wage-guide ${isCompliant ? 'compliant' : 'non-compliant'}`} style={{
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      border: `2px solid ${isCompliant ? '#16a34a' : '#dc2626'}`,
      backgroundColor: isCompliant ? '#f0fdf4' : '#fef2f2'
    }}>
      <h4 className="wage-guide-title" style={{
        margin: '0 0 12px 0',
        color: isCompliant ? '#16a34a' : '#dc2626',
        fontSize: '16px',
        fontWeight: 'bold'
      }}>
        {isCompliant ? '✅ 법적 요건 충족' : '⚠️ 법적 요건 미충족'}
      </h4>
      
      <div className="wage-guide-content">
        <div className="wage-comparison" style={{marginBottom: 16}}>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>입력된 월급:</span>
            <span className="wage-value">{inputWage.toLocaleString()}원</span>
          </div>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>제수당:</span>
            <span className="wage-value">{allowances.toLocaleString()}원</span>
          </div>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8, borderTop: '1px solid #e5e7eb', paddingTop: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>총 월급:</span>
            <span className="wage-value" style={{fontWeight: 'bold'}}>{totalInputWage.toLocaleString()}원</span>
          </div>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>법적 최소 임금:</span>
            <span className="wage-value">{minimumWage.totalMinimumWage.toLocaleString()}원</span>
          </div>
          <div className="wage-difference" style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '8px 12px',
            backgroundColor: isCompliant ? '#dcfce7' : '#fee2e2',
            borderRadius: 6,
            border: `1px solid ${isCompliant ? '#16a34a' : '#dc2626'}`
          }}>
            <span className="difference-label" style={{fontWeight: 'bold'}}>차액:</span>
            <span className={`difference-value ${isCompliant ? 'positive' : 'negative'}`} style={{
              fontWeight: 'bold',
              color: isCompliant ? '#16a34a' : '#dc2626'
            }}>
              {isCompliant ? '+' : '-'}{Math.abs(totalInputWage - minimumWage.totalMinimumWage).toLocaleString()}원
            </span>
          </div>
        </div>
        
        <div className="wage-breakdown" style={{marginBottom: 16}}>
          <h5 className="breakdown-title" style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#374151'
          }}>■ 법적 최소 임금 상세</h5>
          <div className="breakdown-items" style={{fontSize: '13px'}}>
            <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
              <span className="breakdown-label">기본급 ({minimumWage.monthlyWorkHours}시간 × {LEGAL_INFO.MIN_WAGE.toLocaleString()}원):</span>
              <span className="breakdown-value">{minimumWage.basicMinimumWage.toLocaleString()}원</span>
            </div>
            {minimumWage.weeklyHolidayPay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">주휴수당 ({minimumWage.weeklyWorkHours}시간/주):</span>
                <span className="breakdown-value">{minimumWage.weeklyHolidayPay.toLocaleString()}원</span>
              </div>
            )}
            {minimumWage.overtimePay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">연장근로수당 ({minimumWage.overtimeHours}시간, 50%):</span>
                <span className="breakdown-value">{minimumWage.overtimePay.toLocaleString()}원</span>
              </div>
            )}
            {minimumWage.nightPay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">야간근로수당 ({minimumWage.nightHours}시간, 50%):</span>
                <span className="breakdown-value">{minimumWage.nightPay.toLocaleString()}원</span>
              </div>
            )}
          </div>
        </div>
        
        {!isCompliant && (
          <div className="wage-recommendation" style={{
            padding: 12,
            backgroundColor: '#fef3c7',
            borderRadius: 6,
            border: '1px solid #f59e0b'
          }}>
            <h5 className="recommendation-title" style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#92400e'
            }}>■ 권장사항</h5>
            <p className="recommendation-text" style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400e'
            }}>
              법적 최소 임금을 준수하기 위해 월급을 <strong>{minimumWage.totalMinimumWage.toLocaleString()}원</strong> 이상으로 설정하시기 바랍니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 시급제 법적 기준 안내 컴포넌트
function HourlyWageLegalGuide({ form }) {
  if (form.salaryType !== 'hourly' || !form.hourlyWage) {
    return null;
  }
  
  const workStats = calcWorkStats(form);
  const monthlyWorkHours = workStats.totalMonth / 60; // 분을 시간으로 변환
  const weeklyWorkHours = workStats.totalWeek / 60; // 분을 시간으로 변환
  
  const inputHourlyWage = Number(form.hourlyWage) || 0;
  const allowances = Number(form.allowances) || 0;
  const isCompliant = inputHourlyWage >= LEGAL_INFO.MIN_WAGE;
  const difference = inputHourlyWage - LEGAL_INFO.MIN_WAGE;
  
  // 월 예상 임금 계산
  const basicMonthlyWage = Math.round(inputHourlyWage * monthlyWorkHours);
  const weeklyHolidayPay = weeklyWorkHours >= 15 ? Math.round(inputHourlyWage * 8 * 4.345) : 0;
  const overtimePay = Math.round((workStats.over / 60) * inputHourlyWage * 0.5);
  const nightPay = Math.round((workStats.night / 60) * inputHourlyWage * 0.5);
  const totalMonthlyWage = basicMonthlyWage + weeklyHolidayPay + overtimePay + nightPay + allowances;
  
  return (
    <div className={`hourly-wage-guide ${isCompliant ? 'compliant' : 'non-compliant'}`} style={{
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      border: `2px solid ${isCompliant ? '#16a34a' : '#dc2626'}`,
      backgroundColor: isCompliant ? '#f0fdf4' : '#fef2f2'
    }}>
      <h4 className="wage-guide-title" style={{
        margin: '0 0 12px 0',
        color: isCompliant ? '#16a34a' : '#dc2626',
        fontSize: '16px',
        fontWeight: 'bold'
      }}>
        {isCompliant ? '✅ 법적 요건 충족' : '✅ 법적 요건 미충족'}
      </h4>
      
      <div className="wage-guide-content">
        <div className="wage-comparison" style={{marginBottom: 16}}>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>입력된 시급:</span>
            <span className="wage-value">{inputHourlyWage.toLocaleString()}원</span>
          </div>
          <div className="wage-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
            <span className="wage-label" style={{fontWeight: 'bold'}}>최저임금:</span>
            <span className="wage-value">{LEGAL_INFO.MIN_WAGE.toLocaleString()}원</span>
          </div>
          <div className="wage-difference" style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '8px 12px',
            backgroundColor: isCompliant ? '#dcfce7' : '#fee2e2',
            borderRadius: 6,
            border: `1px solid ${isCompliant ? '#16a34a' : '#dc2626'}`
          }}>
            <span className="difference-label" style={{fontWeight: 'bold'}}>차액:</span>
            <span className={`difference-value ${isCompliant ? 'positive' : 'negative'}`} style={{
              fontWeight: 'bold',
              color: isCompliant ? '#16a34a' : '#dc2626'
            }}>
              {isCompliant ? '+' : '-'}{Math.abs(difference).toLocaleString()}원
            </span>
          </div>
        </div>
        
        <div className="wage-breakdown" style={{marginBottom: 16}}>
          <h5 className="breakdown-title" style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#374151'
          }}>■ 월 예상 임금 계산</h5>
          <div className="breakdown-items" style={{fontSize: '13px'}}>
            <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
              <span className="breakdown-label">기본급 ({Math.round(monthlyWorkHours * 10) / 10}시간):</span>
              <span className="breakdown-value">{basicMonthlyWage.toLocaleString()}원</span>
            </div>
            {weeklyHolidayPay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">주휴수당 ({Math.round(weeklyWorkHours * 10) / 10}시간/주):</span>
                <span className="breakdown-value">{weeklyHolidayPay.toLocaleString()}원</span>
              </div>
            )}
            {overtimePay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">연장근로수당 ({Math.round((workStats.over / 60) * 10) / 10}시간, 50%):</span>
                <span className="breakdown-value">{overtimePay.toLocaleString()}원</span>
              </div>
            )}
            {nightPay > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">야간근로수당 ({Math.round((workStats.night / 60) * 10) / 10}시간, 50%):</span>
                <span className="breakdown-value">{nightPay.toLocaleString()}원</span>
              </div>
            )}
            {allowances > 0 && (
              <div className="breakdown-item" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                <span className="breakdown-label">제수당:</span>
                <span className="breakdown-value">{allowances.toLocaleString()}원</span>
              </div>
            )}
            <div className="breakdown-item" style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: 6, 
              borderTop: '1px solid #e5e7eb', 
              paddingTop: 8,
              fontWeight: 'bold'
            }}>
              <span className="breakdown-label">총 월 예상 임금:</span>
              <span className="breakdown-value">{totalMonthlyWage.toLocaleString()}원</span>
            </div>
          </div>
        </div>
        
        {!isCompliant && (
          <div className="wage-recommendation" style={{
            padding: 12,
            backgroundColor: '#fef3c7',
            borderRadius: 6,
            border: '1px solid #f59e0b'
          }}>
            <h5 className="recommendation-title" style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#92400e'
            }}>■ 권장사항</h5>
            <p className="recommendation-text" style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400e'
            }}>
              최저임금을 준수하기 위해 시급을 <strong>{LEGAL_INFO.MIN_WAGE.toLocaleString()}원</strong> 이상으로 설정하시기 바랍니다.
            </p>
          </div>
        )}
        
        {isCompliant && (
          <div className="wage-info" style={{
            padding: 12,
            backgroundColor: '#eff6ff',
            borderRadius: 6,
            border: '1px solid #3b82f6'
          }}>
            <h5 className="info-title" style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1e40af'
            }}>■ 시급제 안내</h5>
            <p className="info-text" style={{
              margin: 0,
              fontSize: '13px',
              color: '#1e40af'
            }}>
              시급제는 기본급 외에 연장근로수당, 야간근로수당, 주휴수당이 별도로 지급됩니다. 
              실제 월 임금은 위 계산 결과보다 높을 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 특정 요일의 근무시간을 계산하는 함수
function getBtnTime(day, form) {
  const dayTime = form.dayTimes && form.dayTimes[day];
  if (!dayTime || !dayTime.start || !dayTime.end) return '';
  const s = getMinutes(dayTime.start);
  const e = getMinutes(dayTime.end);
  const br = Number(dayTime.break) || 0;
  let work = e > s ? e - s : (e + 24 * 60) - s;
  work = Math.max(0, work - br);
  return getHourStr(work);
}

export default ContractForm; 