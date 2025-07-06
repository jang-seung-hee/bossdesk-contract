import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function ContractPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const [contractHtml, setContractHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(null);

  useEffect(() => {
    // URL 파라미터에서 폼 데이터 가져오기
    const params = new URLSearchParams(location.search);
    const formData = params.get('formData');
    
    if (formData) {
      try {
        const parsedForm = JSON.parse(decodeURIComponent(formData));
        setForm(parsedForm);
        generateContractHtml(parsedForm);
      } catch (error) {
        console.error('폼 데이터 파싱 오류:', error);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [location]);

  // 시간 계산 유틸
  function getMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  // 소정 근로시간에 해당하는 종료 시간 계산
  function getEndTimeForStandardHours(startTime, standardHours) {
    if (!startTime) return '18:00';
    const startMinutes = getMinutes(startTime);
    const endMinutes = startMinutes + (standardHours * 60);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
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

  // 4대보험료 계산 함수
  function calculateInsurance(baseSalary) {
    const rates = {
      NATIONAL_PENSION: 0.09,
      HEALTH_INSURANCE: 0.0709,
      LONG_TERM_CARE: 0.009182,
      EMPLOYMENT_INSURANCE: 0.018,
      INDUSTRIAL_ACCIDENT: 0.0147,
    };
    return {
      nationalPension: Math.round(baseSalary * rates.NATIONAL_PENSION),
      healthInsurance: Math.round(baseSalary * rates.HEALTH_INSURANCE),
      longTermCare: Math.round(baseSalary * rates.LONG_TERM_CARE),
      employmentInsurance: Math.round(baseSalary * rates.EMPLOYMENT_INSURANCE),
      industrialAccident: Math.round(baseSalary * rates.INDUSTRIAL_ACCIDENT),
      total: Math.round(baseSalary * (rates.NATIONAL_PENSION + rates.HEALTH_INSURANCE + rates.LONG_TERM_CARE + rates.EMPLOYMENT_INSURANCE + rates.INDUSTRIAL_ACCIDENT))
    };
  }

  // 수습기간 임금 계산 함수
  function calculateProbationSalary(baseSalary, discountPercent) {
    const discountRate = Number(discountPercent) / 100;
    const discountedSalary = baseSalary * (1 - discountRate);
    const minimumProbationSalary = 2096270 * 0.9; // 최저임금의 90%
    return Math.max(discountedSalary, minimumProbationSalary);
  }

  const generateContractHtml = (form) => {
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
    let overtimeHours = 0, nightHours = 0, standardMonthlyHours = 0, monthlyWorkHours = 0;
    let totalCalculatedSalary = 0;
    
    if (form.salaryType === 'hourly' && hourlyWage > 0) {
      // 야간근로 상수 정의
      const NIGHT_START = 22 * 60, NIGHT_END = 6 * 60;
      // 주간/월간 근로시간(시간 단위)
      const weeklyWorkHours = workStats3.totalWeek / 60;
      monthlyWorkHours = workStats3.totalMonth / 60;
      // 소정근로시간과 연장근로시간 구분
      const standardWeeklyHours = Math.min(40, weeklyWorkHours);
      const overtimeWeeklyHours = Math.max(0, weeklyWorkHours - 40);
      standardMonthlyHours = standardWeeklyHours * 4.345;
      const overtimeMonthlyHours = overtimeWeeklyHours * 4.345;
      // 기본급 (소정근로시간)
      calculatedMonthlySalary = hourlyWage * standardMonthlyHours;
      // 연장수당 (연장근로시간 1.5배)
      overtimeHours = overtimeMonthlyHours;
      overtimePay = hourlyWage * 1.5 * overtimeMonthlyHours;
      // 야간수당 (야간근로시간 0.5배 가산)
      nightHours = workStats3.night / 60;
      nightPay = hourlyWage * 0.5 * nightHours;
      // 주휴수당 (1주 15시간 이상 근로 시, 8시간 기준)
      let weeklyHolidayPay = 0;
      if (weeklyWorkHours >= 15) {
        weeklyHolidayPay = hourlyWage * 8;
      }
      monthlyHolidayPay = weeklyHolidayPay * 4.345;
      // 시급제 총 임금 계산
      totalCalculatedSalary = calculatedMonthlySalary + overtimePay + nightPay + monthlyHolidayPay + allowances;
    }

    // 4대보험료 계산
    const baseSalaryForInsurance = form.salaryType === 'monthly' ? (basePay + allowances) : totalCalculatedSalary;
    const insurance = calculateInsurance(baseSalaryForInsurance);
    
    // 수습기간 임금 계산 (시급제: 소정근로시간만 감액)
    let probationSalary = 0;
    if (form.salaryType === 'hourly' && form.probationPeriod) {
      const discountRate = Number(form.probationDiscount) / 100;
      const probationStandardSalary = hourlyWage * standardMonthlyHours * (1 - discountRate);
      probationSalary = probationStandardSalary + overtimePay + nightPay + monthlyHolidayPay + allowances;
    } else if (form.salaryType === 'monthly' && form.probationPeriod) {
      const baseSalaryForProbation = Number(form.monthlySalary);
      const probationBaseSalary = calculateProbationSalary(baseSalaryForProbation, form.probationDiscount);
      const workStats = calcWorkStats(form);
      const weeklyWorkHours = workStats.totalWeek / 60;
      const hourlyWage = Number(form.monthlySalary) / (workStats.totalMonth / 60);
      const weeklyHolidayPay = weeklyWorkHours >= 15 ? Math.round(hourlyWage * 8 * 4.345) : 0;
      probationSalary = probationBaseSalary + weeklyHolidayPay + allowances;
    } else {
      probationSalary = totalCalculatedSalary;
    }
    
    const baseSalary = form.salaryType === 'monthly' 
      ? (form.monthlySalary ? `${Number(form.monthlySalary).toLocaleString()}원` : '[0,000,000]원')
      : (form.hourlyWage ? `${form.hourlyWage.toLocaleString()}원/시간` : '[0,000]원/시간');
    const allowancesText = form.allowances ? Number(form.allowances).toLocaleString() : '[식대, 교통비, 직책수당 등]';
    // 월급제 총 임금 계산 (주휴수당 포함)
    let monthlyTotalSalary = 0;
    if (form.salaryType === 'monthly' && form.monthlySalary) {
      const monthlyWorkHours = workStats3.totalMonth / 60;
      const weeklyWorkHours = workStats3.totalWeek / 60;
      const hourlyWage = Number(form.monthlySalary) / monthlyWorkHours;
      const weeklyHolidayPay = weeklyWorkHours >= 15 ? Math.round(hourlyWage * 8 * 4.345) : 0;
      monthlyTotalSalary = Number(form.monthlySalary) + weeklyHolidayPay + allowances;
    }

    const totalSalary = form.salaryType === 'monthly'
      ? (form.monthlySalary 
          ? `${monthlyTotalSalary.toLocaleString()}원 (세전)`
          : '[0,000,000]원')
      : (form.salaryType === 'hourly' && hourlyWage > 0 
          ? `${Math.round(totalCalculatedSalary).toLocaleString()}원 (시급제 계산)`
          : '[시급제 계산 참조]');

    // 실제 근로시간 계산
    const workStats = calcWorkStats(form);
    const weeklyWorkHours = workStats.totalWeek / 60; // 분을 시간으로 변환
    const dailyWorkHours = weeklyWorkHours / form.days.length; // 일일 근로시간
    
    // 소정 근로시간과 연장 근로시간 구분
    const standardWeeklyHours = Math.min(40, weeklyWorkHours); // 소정 근로시간 (최대 40시간)
    const overtimeWeeklyHours = Math.max(0, weeklyWorkHours - 40); // 연장 근로시간
    const standardDailyHours = standardWeeklyHours / form.days.length; // 일일 소정 근로시간
    const overtimeDailyHours = overtimeWeeklyHours / form.days.length; // 일일 연장 근로시간
    
    // 소정 근로시간 텍스트 생성
    const standardWorkTimeText = form.workTimeType === 'same' 
      ? `1일 ${standardDailyHours.toFixed(1)}시간, 1주 ${standardWeeklyHours.toFixed(1)}시간 (${form.days.join(', ')}, ${form.commonStart || '09:00'} ~ ${getEndTimeForStandardHours(form.commonStart || '09:00', standardDailyHours)})`
      : `요일별 상이 (${form.days.join(', ')}) - 주 ${standardWeeklyHours.toFixed(1)}시간`;
    
    // 연장 근로시간 텍스트 생성 (연장근로가 있는 경우에만)
    const overtimeWorkTimeText = overtimeWeeklyHours > 0 ? (form.workTimeType === 'same' 
      ? `1일 ${overtimeDailyHours.toFixed(1)}시간, 1주 ${overtimeWeeklyHours.toFixed(1)}시간 (${form.days.join(', ')}, ${getEndTimeForStandardHours(form.commonStart || '09:00', standardDailyHours)} ~ ${form.commonEnd || '18:00'})`
      : `요일별 상이 (${form.days.join(', ')}) - 주 ${overtimeWeeklyHours.toFixed(1)}시간`) : '';
    
    // 총 근로시간 텍스트
    const totalWorkTimeText = `1일 ${dailyWorkHours.toFixed(1)}시간, 1주 ${weeklyWorkHours.toFixed(1)}시간 (연장근로 포함)`;

    const breakText = form.workTimeType === 'same'
      ? `1일 ${(Number(form.commonBreak) / 60).toFixed(1)}시간 (근로시간 중 ${form.commonStart || '12:00'} ~ ${form.commonEnd || '13:00'})`
      : `요일별 상이 (${form.days.map(day => {
          const dayTime = form.dayTimes[day];
          if (dayTime && dayTime.break) {
            return `${day}: ${(Number(dayTime.break) / 60).toFixed(1)}시간`;
          }
          return day;
        }).join(', ')})`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>표준 근로계약서</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f4f8;
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .contract-container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 2.5rem;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            border: 1px solid #e2e8f0;
        }
        @media print {
            html, body {
                margin: 0 !important;
                padding: 0 !important;
            }
            .contract-container {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .contract-container, .contract-content, header {
                page-break-before: auto !important;
                page-break-after: auto !important;
                break-before: auto !important;
                break-after: auto !important;
            }
            .signature-boxes {
                display: flex !important;
                flex-wrap: nowrap !important;
                gap: 0.5rem !important;
                justify-content: center !important;
            }
            .sig-box {
                min-width: 120px !important;
                max-width: 160px !important;
                width: 120px !important;
                padding: 0.7rem 0.7rem !important;
                font-size: 0.95rem !important;
                flex: 1 1 120px !important;
            }
        }
        .contract-content {
            position: relative;
            z-index: 1;
        }
        .legal-notice {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 0.8rem 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
            text-align: center;
        }
        .legal-notice p {
            font-family: 'Noto Sans KR', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            margin: 0;
            line-height: 1.4;
        }
        .section-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
            margin-top: 2rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #cbd5e1;
        }
        .icon { font-size: 1.8rem; line-height: 1; }
        .contract-table { width: 100%; min-width: 100%; }
        .contract-table th, .contract-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
        }
        .contract-table th { background-color: #f8fafc; font-weight: 600; color: #475569; }
        .contract-table tr:last-child td { border-bottom: none; }
        .note { 
            background-color: #e0f2fe; 
            border-left: 5px solid #38b2ac; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-top: 1.5rem; 
            color: #0c4a6e; 
        }
        .note .title { font-weight: bold; margin-bottom: 0.5rem; }
        .note .content { font-weight: normal; }
        .info-box { color: #5B3A29; background: #f9f6f2; border-left: 5px solid #5B3A29; padding: 1rem; border-radius: 8px; margin: 1.5rem 0; font-weight: 500; }
        .party-table, .period-table, .job-table { width: 100%; min-width: 100%; }
        .party-table th, .party-table td, .period-table th, .period-table td, .job-table th, .job-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e2e8f0;
        }
        .party-table th, .period-table th, .job-table th { background: #f8fafc; font-weight: 600; color: #475569; }
        .party-table tr:last-child td, .period-table tr:last-child td, .job-table tr:last-child td { border-bottom: none; }
        .indent-list { padding-left: 1.5rem; }
        .numbered-list { padding-left: 2rem; }
        .numbered-list li { margin-bottom: 0.5rem; }
        .signature-section { text-align: center; margin-top: 3rem; }
        .signature-title { font-size: 1.5rem; font-weight: 700; color: #22223b; margin-bottom: 0.5rem; }
        .signature-desc { color: #374151; font-size: 1.1rem; margin-bottom: 2rem; }
        .signature-boxes {
            display: flex;
            flex-wrap: nowrap;
            gap: 2rem;
            justify-content: center;
            max-width: 600px;
            margin: 0 auto;
        }
        .sig-box {
            min-width: 210px;
            max-width: 260px;
            width: 100%;
            padding: 1.2rem 1.2rem;
            font-size: 1.05rem;
            flex: 1 1 210px;
        }
        .sig-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.7rem; }
        .sig-title.user { color: #2563eb; }
        .sig-title.worker { color: #059669; }
        .sig-info { font-size: 1.05rem; color: #22223b; margin-bottom: 0.5rem; }
        .sig-label { font-weight: 600; }
        .sig-seal { border-top: 2px dashed #cbd5e1; margin-top: 1.5rem; padding-top: 1rem; color: #6b7280; font-size: 0.95rem; }
        .signature-footer { color: #6b7280; font-size: 0.98rem; margin-top: 1.5rem; }
        .signature-date { color: #374151; font-size: 1.05rem; margin-top: 0.5rem; }
        @media (max-width: 800px) {
            .signature-boxes { flex-direction: column; gap: 1.5rem; }
        }
        @media print {
            body, .contract-container, .contract-container::before {
                background: white !important;
                background-image: none !important;
                box-shadow: none !important;
            }
            .no-print {
                display: none !important;
            }
            /* 버튼 등 인쇄 제외 */
            button, .print-btn, .download-btn, .edit-btn {
                display: none !important;
            }
            .signature-boxes {
                gap: 1.5rem !important;
                max-width: 600px !important;
            }
            .sig-box {
                min-width: 200px !important;
                max-width: 240px !important;
                padding: 1rem 1rem !important;
                font-size: 1rem !important;
                flex: 1 1 200px !important;
            }
        }
        /* 플로팅 버튼 CSS */
        .floating-action-buttons {
            position: fixed;
            left: 50%;
            bottom: 2.5rem;
            transform: translateX(-50%);
            display: flex;
            flex-direction: row;
            gap: 1.5rem;
            z-index: 1000;
        }
        .fab-btn {
            padding: 0.9rem 2.2rem;
            border-radius: 2rem;
            box-shadow: 0 4px 16px rgba(0,0,0,0.10);
            font-weight: bold;
            font-size: 1.08rem;
            border: none;
            cursor: pointer;
            transition: background 0.2s;
            background: #f1f5f9;
            color: #22223b;
        }
        .fab-btn.edit-btn { background: #64748b; color: #fff; }
        .fab-btn.print-btn { background: #2563eb; color: #fff; }
        .fab-btn.download-btn { background: #059669; color: #fff; }
        .fab-btn:hover { filter: brightness(0.95); }
        @media print {
            .floating-action-buttons { display: none !important; }
        }
    </style>
</head>
<body class="p-4 sm:p-6 md:p-8">
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
      <div class="contract-container">
        <div class="contract-content">
        <div class="legal-notice">
            <p>이 문서는 <strong>"사장님은 법대로"</strong> 앱으로 근로기준법을 기초로 작성되었습니다.</p>
        </div>
        
        <header class="text-center mb-10">
            <h1 class="text-6xl font-black" style="color:#1e293b; color:#1e3a8a; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">${form.storeName || '[회사명]'} 근로계약서</h1>
            <p class="text-lg text-gray-700" style="font-size: 1.25rem; color: #22223b; font-weight: 500; margin-top:0.5rem;">같이 일하게 되어 기대가 됩니다. 함께 성장하는 동반자가 되겠습니다.</p>
        </header>

        <div class="info-box">
            <span style="font-weight:700;">■ 2025년 최신 법적 정보</span><br>
            <span>• 최저시급: 10,030원/시간</span><br>
            <span>• 최저월급: 2,096,270원 (209시간 기준)</span><br>
            <span>• 4대보험료: 국민연금 4.5%, 건강보험 3.5%, 장기요양보험 0.46%, 고용보험 0.9%, 산재보험</span>
        </div>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제1조 (계약의 목적)</h2>
            <p class="text-gray-700 leading-relaxed">
                본 계약은 ${form.storeName || '[회사명]'} (이하 "갑"이라 한다)과 ${form.name || '[근로자명]'} (이하 "을"이라 한다) 간에 근로기준법 및 기타 관련 법규에 의거하여 근로 조건을 명확히 하고, 상호 간의 권리와 의무를 성실히 이행함을 목적으로 한다.
            </p>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 계약의 기본 원칙</div>
                <div class="content">근로계약은 근로기준법 제2조에 따라 근로자와 사용자 간에 근로조건을 정하는 계약입니다. 본 계약은 법이 정한 최저 기준을 준수하며, 근로기준법에 미달하는 근로조건은 무효가 되고 그 부분은 근로기준법에 따릅니다 (근로기준법 제6조).</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제2조 (당사자)</h2>
            <div class="overflow-x-auto">
                <table class="party-table">
                    <thead>
                        <tr>
                            <th style="width:30%">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>갑 (사용자)</strong></td>
                            <td>
                                <p><strong>회사명:</strong> ${form.storeName || '[회사명]'}</p>
                                <p><strong>대표자:</strong> ${form.owner || '[대표자명]'}</p>
                                <p><strong>주소:</strong> ${form.address || '[주소]'} ${form.addressDetail || ''}</p>
                                <p><strong>연락처:</strong> ${form.storeContact || '[연락처]'}</p>
                            </td>
                        </tr>
                        <tr>
                            <td><strong>을 (근로자)</strong></td>
                            <td>
                                <p><strong>성명:</strong> ${form.name || '[근로자명]'}</p>
                                <p><strong>생년월일:</strong> ${form.birth || '[생년월일]'}</p>
                                <p><strong>주소:</strong> ${form.workerAddress || '[주소]'} ${form.workerAddressDetail || ''}</p>
                                <p><strong>연락처:</strong> ${form.contact || '[연락처]'}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 당사자 정보의 중요성</div>
                <div class="content">사용자와 근로자의 정확한 정보는 계약의 유효성을 확인하고, 향후 발생할 수 있는 법적 분쟁 시 당사자를 명확히 하는 데 필수적입니다. 특히 근로자의 개인정보는 "개인정보 보호법"에 따라 안전하게 관리되어야 합니다.</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제3조 (근로계약 기간)</h2>
            <div class="overflow-x-auto">
                <table class="period-table">
                    <thead>
                        <tr>
                            <th style="width:30%">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>계약 시작일</strong></td>
                            <td>${form.periodStart || '[시작일]'}</td>
                        </tr>
                        <tr>
                            <td><strong>계약 종료일</strong></td>
                            <td>${form.periodEnd || '무기한'}</td>
                        </tr>
                        <tr>
                            <td><strong>수습 기간</strong></td>
                            <td>${form.probationPeriod || '없음'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 근로계약 기간 및 수습</div>
                <div class="content">근로계약은 기간을 정할 수도 있고(기간제 근로), 기간을 정하지 않을 수도 있습니다(정규직). 기간제 근로계약은 원칙적으로 2년을 초과할 수 없으며, 2년을 초과하여 사용하는 경우 기간의 정함이 없는 근로자로 간주됩니다 (기간제법 제4조).</div>
                <div class="content">수습 기간은 근로자의 업무 적응 및 능력 평가를 위한 기간으로, 근로기준법 제35조 및 동법 시행령 제3조에 따라 3개월 이내의 수습 근로자에 대해서는 해고예고 규정이 적용되지 않을 수 있으며, 최저임금의 90% 이상을 지급할 수 있습니다.</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제4조 (근무 장소 및 업무 내용)</h2>
            <div class="overflow-x-auto">
                <table class="job-table">
                    <thead>
                        <tr>
                            <th style="width:30%">구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>근무 장소</strong></td>
                            <td>${form.workLocation || '[근무장소]'}</td>
                        </tr>
                        <tr>
                            <td><strong>업무 내용</strong></td>
                            <td>${form.jobDesc || '[업무내용]'}</td>
                        </tr>
                        <tr>
                            <td><strong>직위/직책</strong></td>
                            <td>${form.position || '[직책]'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 근무 장소 및 업무의 명확화</div>
                <div class="content">근무 장소와 업무 내용은 근로계약의 중요한 요소입니다. 이는 근로자의 권리 보호뿐만 아니라, 사용자의 인사권 행사 범위에도 영향을 미칩니다. 업무 내용이 포괄적일 경우 향후 업무 지시 범위에 대한 분쟁이 발생할 수 있으므로 최대한 구체적으로 명시하는 것이 좋습니다.</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제5조 (근로시간 및 휴게시간)</h2>
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
                            <td>${standardWorkTimeText}</td>
                        </tr>
                        ${overtimeWeeklyHours > 0 ? `
                        <tr>
                            <td><strong>연장 근로시간</strong></td>
                            <td>${overtimeWorkTimeText}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td><strong>휴게 시간</strong></td>
                            <td>${breakText} (근로시간 중 근로자와 협의하여 부여)</td>
                        </tr>
                        <tr>
                            <td><strong>총 근로시간</strong></td>
                            <td>${totalWorkTimeText}</td>
                        </tr>
                        <tr>
                            <td><strong>기타 연장/야간/휴일 근로</strong></td>
                            <td>갑의 지시 또는 을의 동의 하에 가능하며, 근로기준법에 따라 가산수당 지급 (연장근로는 주 12시간을 한도로 함)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 근로시간 및 가산수당</div>
                <div class="content">근로기준법 제50조에 따라 1주간의 근로시간은 40시간을, 1일의 근로시간은 8시간을 초과할 수 없습니다. 휴게시간은 근로시간 4시간에 30분 이상, 8시간에 1시간 이상을 부여해야 하며 (근로기준법 제54조), 자유롭게 이용할 수 있어야 합니다.</div>
                <div class="content">연장근로(1주 12시간 한도), 야간근로(오후 10시부터 오전 6시까지), 휴일근로에 대해서는 통상임금의 50% 이상을 가산하여 지급해야 합니다 (근로기준법 제56조). 주 52시간 근무제는 연장근로를 포함한 총 근로시간을 의미합니다.</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제6조 (휴일 및 휴가)</h2>
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
                            <td>"관공서의 공휴일에 관한 규정"에 따른 유급 휴일</td>
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
                <div class="title">■ 중요 안내: 휴일 및 연차 유급 휴가</div>
                <div class="content">주휴일은 1주간 소정근로일을 개근한 근로자에게 주어지는 유급 휴일입니다 (근로기준법 제55조). 법정 공휴일은 2022년부터 모든 사업장에 유급 휴일로 적용됩니다.</div>
                <div class="content">연차 유급 휴가는 근로기준법 제60조에 따라 1년간 80% 이상 출근한 근로자에게 15일이 부여되며, 3년 이상 계속 근로 시 2년마다 1일씩 가산됩니다. 1년 미만 근로자 또는 1년간 80% 미만 출근한 근로자에게는 1개월 개근 시 1일의 유급휴가가 부여됩니다. 사용자는 근로자의 연차 사용을 촉진할 의무가 있습니다.</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제7조 (임금)</h2>
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
                            <td>${baseSalary} ${form.salaryType === 'monthly' && form.monthlySalary ? `(월 소정근로시간 ${(workStats3.totalMonth / 60).toFixed(1)}시간 × 시급 ${Math.round(Number(form.monthlySalary) / (workStats3.totalMonth / 60)).toLocaleString()}원)` : ''}</td>
                        </tr>
                        <tr>
                            <td><strong>제수당</strong></td>
                            <td>${allowancesText}원 (식대, 교통비, 복리후생비)</td>
                        </tr>
                        <tr>
                            <td><strong>총 월 임금</strong></td>
                            <td>${totalSalary} ${form.salaryType === 'monthly' && form.monthlySalary ? `(상기 기본급, 주휴수당, 제수당의 합계액)` : ''}</td>
                        </tr>
                        ${form.probationPeriod ? `
                        <tr>
                            <td style="color: #6b7280; font-weight: normal;"><strong style="color: #6b7280;">수습기간 임금</strong></td>
                            <td style="color: #6b7280; font-weight: normal;">
                                <p><strong style="color: #6b7280;">수습기간:</strong> ${form.probationPeriod}</p>
                                <p><strong style="color: #6b7280;">수습기간 임금:</strong> ${probationSalary.toLocaleString()}원</p>
                                <p><strong style="color: #6b7280;">감액률:</strong> ${form.probationDiscount}%</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #6b7280; font-weight: normal;"><strong style="color: #6b7280;">수습기간 임금 상세 내역</strong></td>
                            <td style="color: #6b7280; font-weight: normal;">
                                ${(() => {
                                    if (form.salaryType === 'hourly') {
                                        const baseSalaryForProbation = calculatedMonthlySalary; // 소정근로시간 기준 기본급
                                        const probationBaseSalary = calculateProbationSalary(baseSalaryForProbation, form.probationDiscount);
                                        
                                        return `
                                            <p>• 수습기간 기본급: ${probationBaseSalary.toLocaleString()}원 (정상 기본급 ${baseSalaryForProbation.toLocaleString()}원의 ${100 - Number(form.probationDiscount)}%)</p>
                                            ${overtimePay > 0 ? `<p>• 연장수당: ${Math.round(overtimePay).toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            ${nightPay > 0 ? `<p>• 야간수당: ${Math.round(nightPay).toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            ${monthlyHolidayPay > 0 ? `<p>• 주휴수당: ${Math.round(monthlyHolidayPay).toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            ${allowances > 0 ? `<p>• 제수당: ${allowances.toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            <p style="border-top: 1px solid #e5e7eb; padding-top: 8px; font-weight: bold; margin-top: 8px; color: #6b7280;">
                                                수습기간 총 임금: ${probationSalary.toLocaleString()}원
                                            </p>
                                        `;
                                    } else {
                                        const baseSalaryForProbation = Number(form.monthlySalary);
                                        const probationBaseSalary = calculateProbationSalary(baseSalaryForProbation, form.probationDiscount);
                                        const workStats = calcWorkStats(form);
                                        const weeklyWorkHours = workStats.totalWeek / 60;
                                        const hourlyWage = Number(form.monthlySalary) / (workStats.totalMonth / 60);
                                        const weeklyHolidayPay = weeklyWorkHours >= 15 ? Math.round(hourlyWage * 8 * 4.345) : 0;
                                        
                                        return `
                                            <p>• 수습기간 기본급: ${probationBaseSalary.toLocaleString()}원 (정상 기본급 ${baseSalaryForProbation.toLocaleString()}원의 ${100 - Number(form.probationDiscount)}%)</p>
                                            ${weeklyWorkHours >= 15 ? `<p>• 주휴수당: ${weeklyHolidayPay.toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            ${allowances > 0 ? `<p>• 제수당: ${allowances.toLocaleString()}원 (수습기간에도 동일하게 지급)</p>` : ''}
                                            <p style="border-top: 1px solid #e5e7eb; padding-top: 8px; font-weight: bold; margin-top: 8px; color: #6b7280;">
                                                수습기간 총 임금: ${(probationBaseSalary + weeklyHolidayPay + allowances).toLocaleString()}원
                                            </p>
                                        `;
                                    }
                                })()}
                            </td>
                        </tr>
                        ` : ''}
                        ${form.salaryType === 'hourly' && hourlyWage > 0 ? `
                        <tr>
                            <td><strong>월 급여 상세 내역</strong></td>
                            <td>
                                ${(() => {
                                    return `
                                        <p>• 기본급 (${hourlyWage.toLocaleString()}원 × ${standardMonthlyHours.toFixed(1)}시간): ${Math.round(calculatedMonthlySalary).toLocaleString()}원</p>
                                        ${overtimeHours > 0 ? `<p>• 연장수당 (${hourlyWage.toLocaleString()}원 × 1.5 × ${overtimeHours.toFixed(1)}시간): ${Math.round(overtimePay).toLocaleString()}원</p>` : ''}
                                        ${nightHours > 0 ? `<p>• 야간수당 (${hourlyWage.toLocaleString()}원 × 0.5 × ${nightHours.toFixed(1)}시간): ${Math.round(nightPay).toLocaleString()}원</p>` : ''}
                                        ${monthlyHolidayPay > 0 ? `<p>• 주휴수당 (${hourlyWage.toLocaleString()}원 × 8시간 × 4.345주): ${Math.round(monthlyHolidayPay).toLocaleString()}원</p>` : ''}
                                        ${allowances > 0 ? `<p>• 제수당: ${allowances.toLocaleString()}원</p>` : ''}
                                        <p style="border-top: 1px solid #e5e7eb; padding-top: 8px; font-weight: bold; margin-top: 8px;">
                                            월 총 임금: ${Math.round(totalCalculatedSalary).toLocaleString()}원 (세전, 주휴수당 포함 시)
                                        </p>
                                    `;
                                })()}
                            </td>
                        </tr>
                        ` : ''}
                        ${form.salaryType === 'monthly' && form.monthlySalary ? `
                        <tr>
                            <td><strong>월급 명세서</strong></td>
                            <td>
                                ${(() => {
                                  const workStats = calcWorkStats(form);
                                  const monthlyWorkHours = workStats.totalMonth / 60;
                                  const weeklyWorkHours = workStats.totalWeek / 60;
                                  const hourlyWage = Number(form.monthlySalary) / monthlyWorkHours;
                                  const weeklyHolidayPay = weeklyWorkHours >= 15 ? Math.round(hourlyWage * 8 * 4.345) : 0;
                                  
                                  return `
                                    <p>• 기본급 (${monthlyWorkHours.toFixed(1)}시간 × ${hourlyWage.toFixed(0)}원): ${Number(form.monthlySalary).toLocaleString()}원</p>
                                    ${weeklyWorkHours >= 15 ? `<p>• 주휴수당 (${hourlyWage.toFixed(0)}원 × 8시간 × 4.345주): ${weeklyHolidayPay.toLocaleString()}원</p>` : ''}
                                    ${allowances > 0 ? `<p>• 제수당: ${allowances.toLocaleString()}원</p>` : ''}
                                    <p>• 기타 연장근로수당 등: 별도</p>
                                    <p style="border-top: 1px solid #e5e7eb; padding-top: 8px; font-weight: bold; margin-top: 8px;">
                                      월 총 임금: ${(Number(form.monthlySalary) + weeklyHolidayPay + allowances).toLocaleString()}원 (세전, 주휴수당 포함 시)
                                    </p>
                                  `;
                                })()}
                            </td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td><strong>임금 지급일</strong></td>
                            <td>${form.payday || '매월 25일'}</td>
                        </tr>
                        <tr>
                            <td><strong>지급 방법</strong></td>
                            <td>${form.paymentMethod || '계좌이체'}</td>
                        </tr>
                        <tr>
                            <td><strong>임금 계산 기간</strong></td>
                            <td>매월 1일부터 말일까지</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 임금 지급의 원칙</div>
                <div class="content">법정 수당(연장, 야간, 휴일근로수당 등)은 월 총 임금 외에 발생 시 별도로 가산하여 지급됩니다. 주휴수당은 월 총 임금에 포함되어 지급됩니다. (2025년 최저시급: 10,030원/시간, 최저월급: 2,096,270원 (209시간 기준))</div>
                <div class="content">※ 연장, 야간, 휴일근로가 발생할 경우 해당 수당은 근로기준법에 따라 별도로 계산하여 지급한다.</div>
                ${form.probationPeriod ? `
                <div class="content" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #6b7280; font-weight: normal;">
                    <strong style="color: #6b7280;">■ 수습기간 임금 안내:</strong><br>
                    • 수습기간: ${form.probationPeriod}<br>
                    • 수습기간 임금: ${probationSalary.toLocaleString()}원 (정상 임금: ${(form.salaryType === 'hourly' ? totalCalculatedSalary : (Number(form.monthlySalary) + (workStats3.totalWeek / 60 >= 15 ? Math.round((Number(form.monthlySalary) / (workStats3.totalMonth / 60)) * 8 * 4.345) : 0) + allowances)).toLocaleString()}원)<br>
                    • 수습기간 중에는 최저임금의 90% 이상을 지급할 수 있습니다 (근로기준법 제35조)<br>
                    • 수습기간 중에도 주휴수당, 연장수당, 야간수당, 제수당은 정상적으로 지급됩니다<br>
                    • 기본급만 감액 적용되며, 기타 수당은 감액되지 않습니다
                </div>
                ` : ''}
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제8조 (사회보험)</h2>
            <p class="text-gray-700 leading-relaxed">갑과 을은 근로기준법 및 관련 법령에 따라 4대 사회보험 (국민연금, 건강보험, 고용보험, 산재보험)에 가입하며, 보험료는 관계 법령에 따라 갑과 을이 각각 부담한다.</p>
            
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
                            <td>${Math.round(insurance.nationalPension / 2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.nationalPension / 2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>건강보험 (3.545%)</strong></td>
                            <td>${Math.round(insurance.healthInsurance / 2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.healthInsurance / 2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>장기요양보험 (0.4591%)</strong></td>
                            <td>${Math.round(insurance.longTermCare / 2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.longTermCare / 2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>고용보험 (0.9%)</strong></td>
                            <td>${Math.round(insurance.employmentInsurance / 2).toLocaleString()}원</td>
                            <td>${Math.round(insurance.employmentInsurance / 2).toLocaleString()}원</td>
                        </tr>
                        <tr>
                            <td><strong>산재보험 (1.47%)</strong></td>
                            <td>0원</td>
                            <td>${insurance.industrialAccident.toLocaleString()}원</td>
                        </tr>
                        <tr class="bg-blue-50">
                            <td><strong>총 보험료</strong></td>
                            <td><strong>${Math.round((insurance.nationalPension + insurance.healthInsurance + insurance.longTermCare + insurance.employmentInsurance) / 2).toLocaleString()}원</strong></td>
                            <td><strong>${Math.round((insurance.nationalPension + insurance.healthInsurance + insurance.longTermCare + insurance.employmentInsurance) / 2 + insurance.industrialAccident).toLocaleString()}원</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 4대 사회보험</div>
                <div class="content">4대 사회보험은 근로자의 생활 안정과 복지 증진을 위한 필수적인 제도입니다. 국민연금, 건강보험, 고용보험은 근로자와 사용자가 보험료를 분담하며, 산재보험은 전액 사용자가 부담합니다. 각 보험의 가입 및 보험료 납부는 법적 의무 사항입니다.</div>
                <div class="content"><strong>2025년 4대보험료 요율:</strong> 국민연금 4.5%, 건강보험 3.545%, 장기요양보험 0.4591%, 고용보험 0.9%, 산재보험 업종별(평균 1.47%)</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제9조 (계약 해지)</h2>
            <p class="text-gray-700 leading-relaxed">본 계약은 다음 각 호의 사유 발생 시 해지될 수 있다.</p>
            <ol class="numbered-list text-gray-700">
                <li>상호 합의에 의한 해지</li>
                <li>갑 또는 을이 본 계약 내용을 위반한 경우</li>
                <li>근로기준법 및 기타 관련 법령에 의거한 해고 또는 사직 사유가 발생한 경우</li>
                <li>갑의 사업 폐지, 경영상 필요 등 정당한 사유가 있는 경우 (30일 전 통지)</li>
                <li>갑 또는 을이 중대한 위반행위를 한 경우</li>
                <li>을의 사직 의사가 있는 경우, 원활한 업무 인수인계 위해 퇴직 예정 30일 전에 사용자에게 통보 주시기 바랍니다.</li>
            </ol>
            ${form.probationPeriod ? `
            <div class="mt-6 overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg shadow-sm contract-table">
                    <thead>
                        <tr>
                            <th class="rounded-tl-lg" style="color: #6b7280; font-weight: normal;">수습기간 만료 후</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="color: #6b7280; font-weight: normal;">
                                <p><strong style="color: #6b7280;">본 채용 여부 결정:</strong> 수습기간 중 업무 능력 및 태도를 평가하며, 결과에 따라 본 채용 여부가 결정됩니다.</p>
                                <p><strong style="color: #6b7280;">정식 채용 시:</strong> 수습기간 종료 후 정식 채용 시에는 정상 임금(감액 없는 임금)으로 변경됩니다.</p>
                                <p><strong style="color: #6b7280;">자동 채용:</strong> 수습 종료 후 1개월 이내에 별도 통지가 없으면 정식 채용된 것으로 간주합니다.</p>
                                <p><strong style="color: #6b7280;">수습기간 연장:</strong> 필요시 상호 합의 하에 연장할 수 있으나, 총 수습기간은 3개월을 초과할 수 없습니다.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : ''}
            <div class="note mt-6">
                <div class="title">■ 유의사항: 계약 해지 및 해고</div>
                <div class="content">사용자는 근로자를 정당한 이유 없이 해고할 수 없습니다 (근로기준법 제23조). 해고 시에는 적어도 30일 전에 예고해야 하며, 30일 전에 예고하지 아니하였을 때에는 30일분 이상의 통상임금을 지급해야 합니다 (해고예고수당, 근로기준법 제26조).</div>
                <div class="content">근로자가 퇴직할 경우에도 회사에 충분한 인수인계 기간을 제공하기 위해 사직 의사를 미리 통보하는 것이 바람직합니다. 퇴직금은 1년 이상 계속 근로한 근로자에게 지급됩니다 (근로자퇴직급여 보장법 제8조).</div>
            </div>
        </section>

        <section class="mb-8">
            <h2 class="section-title"><span class="icon">■</span> 제10조 (기타 사항)</h2>
            <ol class="numbered-list text-gray-700">
                <li>본 계약서에 명시되지 않은 사항은 근로기준법 및 회사의 취업규칙에 따른다.</li>
                <li>을은 회사의 영업 비밀 및 기밀 사항을 외부에 누설하지 아니하며, 퇴직 후에도 이를 준수한다.</li>
                <li>본 계약은 2부를 작성하여 갑과 을이 각각 1부씩 보관한다.</li>
            </ol>
            <div class="note mt-6">
                <div class="title">■ 중요 안내: 취업규칙 및 비밀유지 의무</div>
                <div class="content">취업규칙은 근로기준법 제93조에 따라 상시 10명 이상의 근로자를 사용하는 사용자가 작성하여 고용노동부장관에게 신고해야 하는 규칙으로, 근로조건에 대한 세부적인 사항을 정합니다. 근로계약서에 명시되지 않은 사항은 취업규칙을 따릅니다.</div>
                <div class="content">영업 비밀 및 기밀 유지 의무는 근로자의 중요한 의무 중 하나입니다. 이는 "부정경쟁방지 및 영업비밀보호에 관한 법률"에 의해 보호되며, 위반 시 법적 책임을 질 수 있습니다.</div>
            </div>
        </section>

        <div class="signature-section">
            <div class="signature-title">계약 당사자 서명</div>
            <div class="signature-desc">본 계약의 내용을 충분히 이해하고 동의하며, 상호 성실히 이행할 것을 약속합니다.</div>
            <div class="signature-boxes">
                <div class="sig-box">
                    <div class="sig-title user">갑 (사용자)</div>
                    <div class="sig-info"><span class="sig-label">회사명:</span> ${form.storeName || '[회사명]'}</div>
                    <div class="sig-info"><span class="sig-label">대표자:</span> ${form.owner || '[대표자명]'} (인)</div>
                    <div class="sig-seal">서명 또는 날인</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title worker">을 (근로자)</div>
                    <div class="sig-info"><span class="sig-label">성명:</span> ${form.name || '[근로자명]'}</div>
                    <div class="sig-info"><span class="sig-label">생년월일:</span> ${form.birth || '[생년월일]'}</div>
                    <div class="sig-info"><span class="sig-label">연락처:</span> ${form.contact || '[연락처]'}</div>
                    <div class="sig-seal">서명 또는 날인</div>
                </div>
            </div>
            <div class="signature-date">계약 체결일: ${contractDate}</div>
            <div class="signature-footer">본 계약서는 근로기준법을 바탕으로 작성되었고, 명시되지 않은 부분은 법적 기준을 따릅니다.</div>
        </div>
        </div>
    </div>
</body>
</html>`;

    setContractHtml(htmlContent);
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // 파일명 생성 (근로자명_날짜_시간)
    const workerName = form?.name || '근로자';
    const today = new Date();
    const dateStr = today.getFullYear().toString().slice(-2) + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    const timeStr = String(today.getHours()).padStart(2, '0') + 
                   String(today.getMinutes()).padStart(2, '0');
    const fileName = `근로계약서_${workerName}_${dateStr}_${timeStr}.html`;

    // HTML 파일을 Blob으로 생성하고 다운로드
    const blob = new Blob([contractHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#374151' }}>
            근로계약서 생성 중...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
        <div 
          dangerouslySetInnerHTML={{ __html: contractHtml }}
          style={{ padding: '1rem' }}
        />
      </div>
      {/* 플로팅 버튼은 React 트리의 최상위에 렌더링 */}
      <div className="floating-action-buttons no-print" style={{
        position: 'fixed',
        left: '50%',
        bottom: '2.5rem',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: '1.5rem',
        zIndex: 1000
      }}>
        <button className="fab-btn edit-btn" onClick={handleGoHome}>홈으로</button>
        <button className="fab-btn print-btn" onClick={handlePrint}>인쇄하기</button>
        <button className="fab-btn download-btn" onClick={handleDownload}>다운로드</button>
      </div>
    </>
  );
}

export default ContractPreview; 