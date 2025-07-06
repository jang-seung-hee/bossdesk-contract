import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const MIN_WAGE_2025 = 10030; // 2025년 최저시급
const MIN_MONTHLY_2025 = 2096270; // 2025년 월급제 최저임금(209시간)
const WEEKS_PER_MONTH = 4.345;

function formatNumber(num) {
  if (!num && num !== 0) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 휴게시간 자동 계산 함수 (새로운 규칙)
function getBreakMinutes(workMinutes) {
  if (workMinutes <= 4 * 60) {
    return 30; // 4시간 근무시: 30분
  } else if (workMinutes <= 8 * 60) {
    return 60; // 8시간 근무시: 1시간
  } else if (workMinutes <= 12 * 60) {
    return 90; // 8시간 이상 12시간 이내: 1시간 30분
  } else if (workMinutes <= 16 * 60) {
    return 120; // 12시간 이상 16시간까지: 2시간
  } else {
    return 120; // 16시간 초과시에도 최대 2시간
  }
}

// 야간근로 계산 (22:00~06:00)
function calcNightMinutes(start, workMinutes) {
  const NIGHT_START = 22 * 60, NIGHT_END = 6 * 60;
  let night = 0;
  for (let t = start; t < start + workMinutes; t += 10) {
    const cur = t % (24 * 60);
    if (cur >= NIGHT_START || cur < NIGHT_END) night += 10;
  }
  return night;
}

// 4대보험 가입 조건 판단 함수
function checkInsuranceEligibility(weekWorkHours, monthWorkHours) {
  // 주 15시간 이상 또는 월 60시간 이상 근무 시 4대보험 의무가입
  const isEligible = weekWorkHours >= 15 || monthWorkHours >= 60;
  return {
    isEligible,
    reason: isEligible 
      ? `주 ${weekWorkHours}시간/4대보험가입 대상`
      : `주 ${weekWorkHours}시간/4대보험가입 대상아님`,
    weekHours: weekWorkHours,
    monthHours: monthWorkHours
  };
}

// 예산기반 제안의 근무시간 분배 및 수당 자동계산
function calcAutoAllowance({ wage, weekDays, dayHours, wageType }) {
  // 1일 근무시간(소수점) → 분 단위
  let workMin = Math.round(dayHours * 60);
  let breakMin = getBreakMinutes(workMin);
  let realWorkMin = Math.max(0, workMin - breakMin);
  // 연장근로(1일 8시간 초과)
  let overMin = realWorkMin > 480 ? realWorkMin - 480 : 0;
  // 야간근로(22~06시)
  // 예산기반 제안은 시작시간 임의(09:00)로 가정
  let nightMin = calcNightMinutes(9 * 60, realWorkMin);
  // 주간 합계
  let weekWorkMin = realWorkMin * weekDays;
  let weekOverMin = overMin * weekDays;
  let weekNightMin = nightMin * weekDays;
  // 월평균
  let monthWorkMin = Math.round(weekWorkMin * 4.345);
  let monthOverMin = Math.round(weekOverMin * 4.345);
  let monthNightMin = Math.round(weekNightMin * 4.345);
  // 수당 계산
  let basePay = wage * (monthWorkMin / 60);
  let overtimePay = wage * 0.5 * (monthOverMin / 60);
  let nightPay = wage * 0.5 * (monthNightMin / 60);
  // 주휴수당 계산
  let juhyuPay = 0;
  if (weekWorkMin / 60 >= 15) {
    juhyuPay = wage * ((weekWorkMin / 60) / 40) * 8 * 4.345;
  }
  
  // 총 급여 계산
  let totalPay = basePay + overtimePay + nightPay + juhyuPay;
  
  // 4대보험 가입 조건 확인 및 보험료 계산
  const weekWorkHours = weekWorkMin / 60;
  const monthWorkHours = monthWorkMin / 60;
  const insurance = checkInsuranceEligibility(weekWorkHours, monthWorkHours);
  let insuranceCost = 0;
  // 산재보험은 무조건 부과 (1.47%)
  let sanJaeCost = 0;
  let totalCompanyCost = totalPay;

  // 산재보험 기준: 시급제는 시급×209, 월급제는 월급
  if (wageType === 'hourly') {
    const legalBasePay = wage * 209;
    sanJaeCost = legalBasePay * 0.0147;
  } else {
    sanJaeCost = wage * 0.0147;
  }

  if (insurance.isEligible) {
    // 4대보험(산재 제외) 회사 부담금만 - 시급제는 법정 근무시간 209시간 기준
    const legalBasePay = wage * 209; // 시급 × 209시간
    insuranceCost = legalBasePay * (0.111241 - 0.0147); // 산재보험 제외한 4대보험
    totalCompanyCost = totalPay + insuranceCost + sanJaeCost;
  } else {
    insuranceCost = 0;
    totalCompanyCost = totalPay + sanJaeCost;
  }
  
  return {
    breakMin, overMin, nightMin,
    realWorkMin,
    weekWorkMin, weekOverMin, weekNightMin,
    monthWorkMin, monthOverMin, monthNightMin,
    basePay, overtimePay, nightPay, juhyuPay,
    totalPay, insuranceCost, sanJaeCost, totalCompanyCost,
    insurance
  };
}

// 근로기준법 안내문 (중복 제거, 간결화)
const LABOR_LAW_GUIDE = [
  { title: '최저시급(2025)', desc: '10,030원' },
  { title: '최저월급(2025)', desc: '2,096,270원 (209시간 기준)' },
  { title: '주휴수당', desc: '1주 15시간 이상 근무 시 1일분 임금 추가 지급' },
  { title: '휴게시간', desc: '4시간 근무 시 30분, 8시간 근무 시 1시간, 8시간 초과 시 1시간 30분, 12시간 초과 시 2시간 휴게시간 부여' },
  { title: '연장/야간근로수당', desc: '1일 8시간, 1주 40시간 초과 또는 밤 10시~아침 6시 근무 시 통상임금의 1.5배 이상 지급' },
  { title: '연차수당', desc: '1년간 80% 이상 출근 시 연차유급휴가 발생, 미사용 시 수당 지급' },
  { title: '4대보험 가입 조건', desc: '국민연금, 건강보험, 고용보험은 주 15시간 이상 또는 월 60시간 이상 근무 시 의무가입, 산재보험은 근무시간과 관계없이 모든 근로자 의무가입' },
  { title: '4대보험 부담률', desc: '국민연금 4.5%, 건강보험 3.545%, 장기요양보험 0.4591%, 고용보험 0.9%+α, 산재보험 업종별(평균 1.47%) (총 약 10.4%+α, 회사 부담금만, α=고용안정·직업능력개발사업분)' },
];

// 스택형 막대그래프 컴포넌트
function BudgetBarChart({ result, budget }) {
  if (!result) return null;

  let data = [];
  
  if (result && result.wageType === 'hourly' && result.auto) {
    // 시급제 데이터 - 스택형으로 구성
    const basePay = Math.round(result.auto.basePay || 0);
    const overtimePay = Math.round(result.auto.overtimePay || 0);
    const nightPay = Math.round(result.auto.nightPay || 0);
    const juhyuPay = Math.round(result.auto.juhyuPay || 0);
    const insuranceCost = result.auto.insurance && result.auto.insurance.isEligible ? Math.round(result.auto.insuranceCost || 0) : 0;
    
    data = [
      {
        name: '예산',
        예산: budget || 0,
        기본급: 0,
        연장근로수당: 0,
        야간근로수당: 0,
        주휴수당: 0,
        '4대보험료': 0
      },
      {
        name: '인건비 구성',
        기본급: basePay,
        연장근로수당: overtimePay,
        야간근로수당: nightPay,
        주휴수당: juhyuPay,
        '4대보험료': insuranceCost,
        예산: 0
      }
    ];
  } else if (result && result.wageType === 'monthly' && result.wage) {
    // 월급제 데이터 - 스택형으로 구성
    const baseWage = result.wage || 0;
    // 2025년 4대보험 사업주 부담 요율 (평균)
    // 국민연금 4.5% + 건강보험 3.545% + 장기요양보험 0.4591% + 고용보험 1.15% + 산재보험 1.47% = 11.1241%
    const insuranceCost = Math.round(baseWage * 0.111241);
    
    data = [
      {
        name: '예산',
        예산: budget || 0,
        기본급: 0,
        '4대보험료': 0
      },
      {
        name: '인건비 구성',
        기본급: baseWage,
        '4대보험료': insuranceCost,
        예산: 0
      }
    ];
  }

  if (data.length === 0 || !result) return null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: 0, 
              color: entry.color,
              fontSize: '0.9em'
            }}>
              {entry.name}: {formatNumber(entry.value)}원
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (tickItem) => {
    return formatNumber(tickItem / 10000) + '만';
  };

  const colors = {
    기본급: '#1976d2',
    연장근로수당: '#ff9800',
    야간근로수당: '#9c27b0',
    주휴수당: '#4caf50',
    '4대보험료': '#f44336'
  };

  return (
    <div className="ios-card" style={{marginTop: '1.5rem'}}>
      <div className="ios-card-title">
        <span className="ios-icon">📊</span>인건비 구성 분석
      </div>
      <div style={{ height: '400px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatYAxis}
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="예산" fill="#e0e0e0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="4대보험료" stackId="a" fill={colors['4대보험료']} />
            <Bar dataKey="주휴수당" stackId="a" fill={colors.주휴수당} />
            <Bar dataKey="야간근로수당" stackId="a" fill={colors.야간근로수당} />
            <Bar dataKey="연장근로수당" stackId="a" fill={colors.연장근로수당} />
            <Bar dataKey="기본급" stackId="a" fill={colors.기본급} radius={[4, 0, 0, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ 
        textAlign: 'center', 
        marginTop: '1rem', 
        padding: '0.5rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        fontSize: '0.9em',
        color: '#666'
      }}>
        {(() => {
          let totalLaborCost = 0;
          let isOverBudget = false;
          
          if (result && result.wageType === 'hourly' && result.auto) {
            totalLaborCost = Math.round(result.auto.totalCompanyCost || 0);
            isOverBudget = totalLaborCost > (budget || 0);
          } else if (result && result.wageType === 'monthly' && result.wage) {
            totalLaborCost = Math.round((result.wage || 0) * 1.111241);
            isOverBudget = totalLaborCost > (budget || 0);
          }
          
          const budgetRatio = (budget || 0) > 0 ? Math.round((totalLaborCost / (budget || 0)) * 100) : 0;
          
          return (
            <>
              총 예산: {formatNumber(budget || 0)}원 | 
              총 인건비: {formatNumber(totalLaborCost)}원 | 
              예산 대비: {budgetRatio}%
              {isOverBudget && (
                <span style={{ color: '#d32f2f', fontWeight: 'bold' }}> (예산 초과)</span>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// 근로기준법 아코디언 컴포넌트
function LaborLawAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="guide-outer-box" style={{marginTop:'1.5em'}}>
      <div className="guide-title-row" style={{cursor:'pointer'}} onClick={() => setOpen(o => !o)}>
        <span className="guide-icon">⚖️</span>
        <span className="guide-title">꼭 알아야 할 근로기준법 (2025년 기준)</span>
        <span style={{marginLeft:8, fontSize:'1.1em', color:'#1976d2'}}>{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="guide-desc">
          <div className="guide-inner-box">
            {LABOR_LAW_GUIDE.map((item, i) => (
              <div key={i} style={{marginBottom:'1.1em'}}><b>{item.title}</b><br />{item.desc}</div>
            ))}
            <span style={{fontSize:'0.93em', color:'#888'}}>※ 근로기준법 제54조(휴게), 제56조(연장·야간·휴일근로), 제60조(연차), 제55조(주휴수당) 등 참조</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AllowanceCalculator() {
  const [step, setStep] = useState('budget');
  const [budget, setBudget] = useState('');
  const [budgetType, setBudgetType] = useState('month');
  const [wageType, setWageType] = useState('hourly');
  const [workType, setWorkType] = useState('full');
  const [desiredWage, setDesiredWage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [hourlyWorkMode, setHourlyWorkMode] = useState('5');
  const [applyMinWage, setApplyMinWage] = useState(false);
  const [applyMaxWage, setApplyMaxWage] = useState(false);
  const [dailyHours, setDailyHours] = useState('8');
  const navigate = useNavigate();
  const location = window.location.pathname;
  const shownTipsRef = useRef({});

  // Check if this is the budget-based proposal route
  const isBudgetRoute = location === '/allowance/budget';

  // 입력값 실시간 점검 (조건문 밖으로 이동)
  React.useEffect(() => {
    setError('');
    if (desiredWage) {
      if (wageType === 'hourly' && desiredWage) {
        if (Number(desiredWage.replace(/,/g, '')) < MIN_WAGE_2025) {
          setError(`⚠️ 2025년 법정 최저시급(${formatNumber(MIN_WAGE_2025)}원) 미만입니다.`);
        }
      }
      if (wageType === 'monthly' && desiredWage) {
        if (Number(desiredWage.replace(/,/g, '')) < MIN_MONTHLY_2025) {
          setError('⚠️ 2025년 월급제 법정 최저임금(2,096,270원) 미만입니다.');
        }
      }
    }
  }, [wageType, desiredWage]);

  // If not budget route, show different content
  if (!isBudgetRoute) {
    return (
      <div className="contract-form-page">
        <div className="contract-form-container">
          <div className="form-header">
            <button className="back-btn" onClick={() => navigate('/allowance-menu')}>뒤로</button>
            <div className="form-title">직원 뽑는데 드는 비용</div>
            <div className="header-spacer" />
          </div>
          <div className="step-content">
            <div className="step-container">
              <div className="step-header">
                <div className="step-title">개발 중인 기능</div>
                <div className="step-description">해당 기능은 현재 개발 중입니다. 예산기반 고용제안을 이용해 주세요.</div>
              </div>
              <div className="preview-actions" style={{marginTop:'2rem'}}>
                <button className="nav-btn" onClick={() => navigate('/allowance-menu')}>메뉴로 돌아가기</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 입력값 천단위 콤마 처리
  const handleBudgetChange = (e) => {
    const val = e.target.value.replace(/[^\d]/g, '');
    setBudget(formatNumber(val));
  };
  const handleWageChange = (e) => {
    const val = e.target.value.replace(/[^\d]/g, '');
    setDesiredWage(formatNumber(val));
    setApplyMaxWage(false);
  };

  const handleWageTypeChange = (e) => {
    setWageType(e.target.value);
    setDesiredWage(''); // Reset wage input
    setApplyMaxWage(false); // Reset max wage checkbox
    setApplyMinWage(false); // Also reset min wage checkbox for consistency
  };

  // 근무시간 자동 제안 계산
  const handleSuggest = () => {
    const budgetNum = Number(budget.replace(/,/g, ''));
    let wage = desiredWage ? Number(desiredWage.replace(/,/g, '')) : (wageType === 'hourly' ? MIN_WAGE_2025 : MIN_MONTHLY_2025);
    let info = {};
    if (wageType === 'hourly') {
      // 시급제 근무형태/최적화 분기
      const weekDays = Number(hourlyWorkMode); // 주 근무일수
      // 자동 수당 계산 (입력값 기준)
      const auto = calcAutoAllowance({ wage, weekDays, dayHours: Number(dailyHours), wageType });
      info = {
        wage,
        budgetNum,
        hourlyWorkMode,
        auto: auto
      };
    } else {
      // 월급제: 예산 >= 최저임금이면 풀타임(209시간) 가능, 아니면 불가
      info = {
        wage,
        canFullTime: budgetNum >= MIN_MONTHLY_2025,
        budgetNum
      };
    }
    setResult({ wageType, workType, ...info });
    setStep('result');
  };

  // 랜덤 도움말 메시지 배열
  const tips = [
    '예산을 월 단위로 입력하면 인건비 관리가 더 쉽습니다.',
    '최저임금, 4대보험 등 법적 기준을 꼭 확인하세요.',
    '근무시간이 많을수록 연장·야간수당이 자동으로 포함됩니다.',
    '파트타임은 주휴수당 포함 여부를 꼭 확인하세요.',
    '정규직은 4대보험료 등 추가 비용을 고려해야 합니다.',
    '예산이 부족하면 근무조건을 조정해보세요.',
    '임금은 세전(공제 전) 기준으로 입력하는 것이 일반적입니다.',
    '근로계약서 작성도 잊지 마세요!',
    '실제 지급액은 세금, 수당 등으로 달라질 수 있습니다.',
    '최저임금 미만으로 입력하면 경고가 표시됩니다.',
    '주 15시간 미만 근무 시 4대보험 가입 의무가 없어 인건비 절약이 가능합니다.',
    '4대보험 가입 조건은 주 15시간 또는 월 60시간 이상 근무 시 적용됩니다.'
  ];
  // step별로 랜덤 메시지 고정 (세션 내 동일 step에서 반복 방지)
  const getRandomTip = (stepKey) => {
    if (shownTipsRef.current[stepKey]) return shownTipsRef.current[stepKey];
    const idx = Math.floor(Math.random() * tips.length);
    const tip = tips[idx];
    shownTipsRef.current[stepKey] = tip;
    return tip;
  };

  // 1. Calculate total work hours for hourly wageType
  const totalWeeklyHours = wageType === 'hourly' ? Number(hourlyWorkMode) * Number(dailyHours) : 0;
  const totalMonthlyHours = wageType === 'hourly' ? Math.round(totalWeeklyHours * WEEKS_PER_MONTH) : 0;
  const minWageBudget = wageType === 'hourly' ? MIN_WAGE_2025 * (budgetType === 'week' ? totalWeeklyHours : totalMonthlyHours) : 0;
  const numericBudget = Number(budget.replace(/,/g, ''));
  const isHourlyBudgetEnough = wageType === 'hourly' && numericBudget >= minWageBudget;
  const isHourlyBudgetTooLow = wageType === 'hourly' && numericBudget > 0 && numericBudget < minWageBudget;

  // UI
  return (
    <div className="contract-form-page">
      <div className="contract-form-container">
        <div className="form-header">
          <button className="back-btn" onClick={() => navigate('/allowance-menu')}>뒤로</button>
          <div className="form-title">직원 뽑는데 드는 비용</div>
          <div className="header-spacer" />
        </div>
        <div className="step-content">
          <div className="step-container">
            <div className="step-header">
              <div className="step-title">얼마 정도 있으면 될까?</div>
              <div className="step-description">{getRandomTip(step)}</div>
            </div>
            {step === 'budget' && (
              <div className="guide-outer-box">
                <div className="guide-title-row"><span className="guide-icon">📝</span><span className="guide-title">작성 가이드</span></div>
                <div className="guide-desc">
                  예산에 맞춰서 직원을 고용해 보세요.<br />
                  예산 금액은 "원" 단위로, 숫자만 입력 가능합니다.<br />
                  예산이 작아서 법적 요건(최저임금 등)에 위배 되는 경우에는 <br />
                  바로 안내를 해주니 맘 편하게 예산을 넣고 결과를 확인해 보세요.<br />
                  <div className="guide-inner-box" style={{marginTop:'10px'}}>
                    <b>💡 실무 팁</b><br />
                    ・ 월 예산만 입력을 지원 합니다.<br />
                    ・ 예산은 세전(공제 전) 금액 기준으로 입력하세요.<br />
                    ・ 숫자 이외의 문자는 입력할 수 없습니다.
                  </div>
                </div>
              </div>
            )}
            {step === 'condition' && (
              <>
                <div className="guide-outer-box">
                  <div className="guide-title-row"><span className="guide-icon">📝</span><span className="guide-title">작성 가이드</span></div>
                  <div className="guide-desc">
                    파트타임 알바를 고용하려면 "시급제"를, <br />
                    정직원·계약직을 고용하려면 "월급제"를 선택하세요.<br />
                    시급제의 경우 주간 근무일수를 정할 수 있고, 월급제는 주 5일이 기본입니다.<br />
                    시급과 월급 모두 법에서 정한 최저임금 이상이어야 합니다. <br />
                    주휴수당과 4대보험의 법적인 요건에 해당되면 작성중 안내됩니다.
                    <div className="guide-inner-box" style={{marginTop:'10px'}}>
                      <b>💡 실무 팁</b><br />
                      ・ 시급제는 근무일수와 1일 근무시간을 자유롭게 조정할 수 있습니다.<br />
                      ・ 월급제는 주 5일, 1일 8시간(주 40시간)이 기본입니다.<br />
                      ・ 희망 임금이 법정 최저임금 미만이면 경고가 표시됩니다.<br />
                      ・ 주 15시간 미만 근무 시 4대보험 가입 의무가 없습니다.<br />
                      ・ "예산에 맞춰 근사치 시급 적용" 시 4대보험료 여부도 자동 계산됩니다.
                    </div>
                  </div>
                </div>
              </>
            )}
            {step === 'budget' && (
              <form style={{marginTop:32}} onSubmit={e => {e.preventDefault(); setStep('condition');}}>
                <div className="form-group">
                  <label className="form-label">예산 단위</label>
                  <select value={budgetType} onChange={e => setBudgetType(e.target.value)} className="form-input">
                    <option value="month">월 예산</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">예산 금액</label>
                  <input type="text" inputMode="numeric" placeholder="예: 2,000,000" value={budget} onChange={handleBudgetChange} className="form-input" maxLength={10} />
                </div>
                <div className="navigation-buttons">
                  <button className="nav-btn next-btn" type="submit" disabled={!budget}>다음</button>
                </div>
              </form>
            )}
            {step === 'condition' && (
              <form style={{marginTop:32}} onSubmit={e => {e.preventDefault(); if (!error) handleSuggest();}}>
                <div className="form-group">
                  <label className="form-label">임금 형태</label>
                  <select value={wageType} onChange={handleWageTypeChange} className="form-input">
                    <option value="hourly">시급제</option>
                    <option value="monthly">월급제</option>
                  </select>
                </div>
                {wageType === 'hourly' && (
                  <>
                    <div className="form-group" style={{marginBottom: '8px'}}>
                      <label className="form-label">근무 형태</label>
                      <select value={hourlyWorkMode} onChange={e => setHourlyWorkMode(e.target.value)} className="form-input">
                        <option value="1">주 1일</option>
                        <option value="2">주 2일</option>
                        <option value="3">주 3일</option>
                        <option value="4">주 4일</option>
                        <option value="5">주 5일</option>
                        <option value="6">주 6일</option>
                        <option value="7">주 7일</option>
                      </select>
                      {(() => {
                        const weekWorkHours = Number(hourlyWorkMode) * Number(dailyHours);
                        const monthWorkHours = Math.round(weekWorkHours * 4.345);
                        const insurance = checkInsuranceEligibility(weekWorkHours, monthWorkHours);
                        const juhyuEligible = weekWorkHours >= 15;
                        return (
                          <>
                            {insurance.isEligible && (
                              <div style={{margin: '0 0 6px 0', fontSize: '0.9em', color: '#1976d2', fontWeight: '500'}}>
                                <span role="img" aria-label="green-dot">🟢</span> 근무시간이 주간 {weekWorkHours}시간 월간 {monthWorkHours}시간으로 4대보험 가입 요건이 됩니다
                              </div>
                            )}
                            {juhyuEligible && (
                              <div style={{margin: '0 0 12px 0', fontSize: '0.9em', color: '#1976d2', fontWeight: '500'}}>
                                <span role="img" aria-label="green-dot">🟢</span> 주휴수당 대상입니다 (주 15시간 이상 근무)
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="form-group">
                      <label className="form-label">일일 근무시간</label>
                      <select value={dailyHours} onChange={e => setDailyHours(e.target.value)} className="form-input">
                        {[...Array(12)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1}시간</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {wageType === 'monthly' && (
                  <div className="form-group" style={{marginBottom: '8px'}}>
                    <label className="form-label">근무 형태</label>
                    <select value={workType} onChange={e => setWorkType(e.target.value)} className="form-input">
                      <option value="full">풀타임(주 5일, 40시간)</option>
                    </select>
                    {(() => {
                      const weekWorkHours = 40;
                      const monthWorkHours = 209;
                      const insurance = checkInsuranceEligibility(weekWorkHours, monthWorkHours);
                      if (insurance.isEligible) {
                        return (
                          <div style={{margin: '0 0 12px 0', fontSize: '0.9em', color: '#1976d2', fontWeight: '500'}}>
                            근무시간이 주간 {weekWorkHours}시간 월간 {monthWorkHours}시간으로 4대보험 가입 요건이 됩니다
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">희망 {wageType === 'hourly' ? '시급' : '월급'}</label>
                  <input type="text" inputMode="numeric" placeholder={wageType === 'hourly' ? `예: ${formatNumber(MIN_WAGE_2025)}` : '예: 2,200,000'} value={desiredWage} onChange={handleWageChange} className="form-input" maxLength={10} />
                  {wageType === 'hourly' && (
                    <div style={{marginTop:8}}>
                      {isHourlyBudgetEnough ? (
                        <label style={{fontSize:'0.95em'}}>
                          <input
                            type="checkbox"
                            checked={applyMaxWage}
                            onChange={e => {
                              if (e.target.checked) {
                                setApplyMaxWage(true);
                                setApplyMinWage(false);
                                
                                // 현재 입력된 조건으로 실제 근무시간 계산 (휴게시간 차감 포함)
                                const weekDays = Number(hourlyWorkMode);
                                const dayHours = Number(dailyHours);
                                const workMin = Math.round(dayHours * 60);
                                const breakMin = getBreakMinutes(workMin);
                                const realWorkMin = Math.max(0, workMin - breakMin);
                                
                                // 주간/월간 실제 근무시간 계산
                                const weekWorkHours = (realWorkMin / 60) * weekDays;
                                const monthWorkHours = Math.round(weekWorkHours * 4.345);
                                
                                // 주휴수당 시간 계산
                                const juhyuHours = weekWorkHours >= 15 ? (weekWorkHours / 40) * 8 : 0;
                                const totalPayHours = monthWorkHours + (juhyuHours * 4.345);
                                
                                // 4대보험 가입 조건 확인
                                const insurance = checkInsuranceEligibility(weekWorkHours, monthWorkHours);
                                
                                // 최대 시급 계산
                                let maxWageWithJuhyu = 0;
                                const budgetForMaxWage = numericBudget * 0.95;
                                if (insurance.isEligible) {
                                  // 4대보험 가입 조건인 경우: 전체 4대보험(11.1241%) + 산재보험료(1.47%) 모두 포함
                                  // 총비용 = (시급 × 총근로시간) × 1.096541 + (시급 × 209) × 0.0147
                                  // 이분법으로 시급을 찾음
                                  let left = MIN_WAGE_2025, right = 100000, best = MIN_WAGE_2025;
                                  for (let i = 0; i < 30; i++) {
                                    let mid = (left + right) / 2;
                                    let totalCost = (mid * totalPayHours) * 1.096541 + (mid * 209) * 0.0147;
                                    if (totalCost <= budgetForMaxWage) {
                                      best = mid;
                                      left = mid;
                                    } else {
                                      right = mid;
                                    }
                                  }
                                  // 후처리: 실제 총액이 예산을 넘지 않도록 1원씩 줄임
                                  let testWage = Math.floor(best);
                                  while (testWage > MIN_WAGE_2025) {
                                    let totalCost = (testWage * totalPayHours) * 1.096541 + (testWage * 209) * 0.0147;
                                    if (totalCost <= budgetForMaxWage) break;
                                    testWage--;
                                  }
                                  maxWageWithJuhyu = testWage;
                                } else {
                                  // 4대보험 미가입: 산재보험료만 포함
                                  // 총비용 = (시급 × 총근로시간) + (시급 × 209) × 0.0147
                                  let left = MIN_WAGE_2025, right = 100000, best = MIN_WAGE_2025;
                                  for (let i = 0; i < 30; i++) {
                                    let mid = (left + right) / 2;
                                    let totalCost = (mid * totalPayHours) + (mid * 209) * 0.0147;
                                    if (totalCost <= budgetForMaxWage) {
                                      best = mid;
                                      left = mid;
                                    } else {
                                      right = mid;
                                    }
                                  }
                                  // 후처리: 실제 총액이 예산을 넘지 않도록 1원씩 줄임
                                  let testWage = Math.floor(best);
                                  while (testWage > MIN_WAGE_2025) {
                                    let totalCost = (testWage * totalPayHours) + (testWage * 209) * 0.0147;
                                    if (totalCost <= budgetForMaxWage) break;
                                    testWage--;
                                  }
                                  maxWageWithJuhyu = testWage;
                                }
                                
                                setDesiredWage(formatNumber(maxWageWithJuhyu));
                              } else {
                                setApplyMaxWage(false);
                              }
                            }}
                            style={{marginRight:6}}
                          />
                          예산에 맞춰 근사치 적용
                        </label>
                      ) : isHourlyBudgetTooLow ? (
                        <>
                          <label style={{fontSize:'0.95em'}}>
                            <input
                              type="checkbox"
                              checked={applyMinWage}
                              onChange={e => {
                                setApplyMinWage(e.target.checked);
                                setApplyMaxWage(false);
                                if (e.target.checked) {
                                  setDesiredWage(formatNumber(MIN_WAGE_2025));
                                }
                              }}
                              style={{marginRight:6}}
                            />
                            강제로 최저 시급에 맞춤
                          </label>
                          <div style={{color:'#d32f2f', marginTop:4, fontSize:'0.97em'}}>
                            지금 희망하는 근로 시간은 예산으로는 최저시급에 맞추지 못합니다
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                  {wageType === 'monthly' && (
                    <div style={{marginTop:8}}>
                      {Number(budget.replace(/,/g, '')) < MIN_MONTHLY_2025 ? (
                        <>
                          <div style={{color:'#d32f2f', marginBottom:4, fontSize:'0.97em'}}>
                            ⚠️ 입력하신 예산이 최저월급({formatNumber(MIN_MONTHLY_2025)}원)보다 낮습니다. 최저월급이 자동 적용됩니다.
                          </div>
                          <label style={{fontSize:'0.95em'}}>
                            <input
                              type="checkbox"
                              checked={applyMinWage}
                              onChange={e => {
                                setApplyMinWage(e.target.checked);
                                setApplyMaxWage(false);
                                if (e.target.checked) {
                                  setDesiredWage(formatNumber(MIN_MONTHLY_2025));
                                }
                              }}
                              style={{marginRight:6}}
                            />
                            강제로 최저월급에 맞춤
                          </label>
                        </>
                      ) : (
                        <label style={{fontSize:'0.95em'}}>
                          <input
                            type="checkbox"
                            checked={applyMaxWage}
                            onChange={e => {
                              if (e.target.checked) {
                                setApplyMaxWage(true);
                                setApplyMinWage(false);
                                // 최대 월급 계산
                                const maxWage = Math.floor(Number(budget.replace(/,/g, '')) / 1.111241);
                                setDesiredWage(formatNumber(maxWage));
                              } else {
                                setApplyMaxWage(false);
                              }
                            }}
                            style={{marginRight:6}}
                          />
                          예산에 맞춰 최대 월급 적용
                        </label>
                      )}
                    </div>
                  )}
                  <div className="form-help">
                    {wageType === 'hourly' && budget && (
                      <span style={{display:'block', marginTop:4, color: isHourlyBudgetEnough ? '#1976d2' : '#d32f2f'}}>
                        {isHourlyBudgetEnough
                          ? `✅ 예산이 최저시급(${formatNumber(MIN_WAGE_2025)}원) 이상입니다.`
                          : `⚠️ 입력하신 예산(${formatNumber(Number(budget.replace(/,/g, '')))})이 최저시급(${formatNumber(MIN_WAGE_2025)})보다 낮습니다.`}
                      </span>
                    )}
                    {wageType === 'monthly' && budget && (
                      <span style={{display:'block', marginTop:4, color: Number(budget.replace(/,/g, '')) >= MIN_MONTHLY_2025 ? '#1976d2' : '#d32f2f'}}>
                        {Number(budget.replace(/,/g, '')) < MIN_MONTHLY_2025 ? 
                          `⚠️ 입력하신 예산(${formatNumber(Number(budget.replace(/,/g, '')))})이 최저월급(${formatNumber(MIN_MONTHLY_2025)})보다 낮습니다.` : 
                          `✅ 예산이 최저월급(${formatNumber(MIN_MONTHLY_2025)}원) 이상입니다.`
                        }
                      </span>
                    )}
                  </div>
                </div>
                {error && <div className="salary-note" style={{color:'#d32f2f', marginBottom:12}}>{error}</div>}
                <div className="navigation-buttons">
                  <button className="nav-btn" type="button" onClick={() => setStep('budget')}>이전</button>
                  <button className="nav-btn next-btn" type="submit" disabled={!!error}>제안받기</button>
                </div>
              </form>
            )}
            {step === 'result' && result && (
              <div className="result-certificate-bg" style={{background: 'none', boxShadow: 'none', border: 'none', padding: 0}}>
                <div className="ios-card" style={{marginTop: 12}}>
                  <div className="ios-card-title"><span className="ios-icon">💰</span>{result.wageType === 'hourly' ? '시급제' : '월급제'} 결과</div>
                  <table className="ios-table">
                    <tbody>
                      <tr><th>예산</th><td>{result.wageType === 'hourly' ? `월 ${formatNumber(result.budgetNum)}원` : `${formatNumber(result.budgetNum)}원`}</td></tr>
                      <tr><th>임금</th><td>{result.wageType === 'hourly' ? (() => {
                        const isMinWageCompliant = result.wage >= MIN_WAGE_2025;
                        return (
                          <>
                            {isMinWageCompliant ? '✅' : '❌'} 시급 {formatNumber(result.wage)}원 {isMinWageCompliant ? '(최저시급 이상)' : '(최저시급 미만)'}
                          </>
                        );
                      })() : (() => {
                        const isMinWageCompliant = result.wage >= MIN_MONTHLY_2025;
                        return (
                          <>
                            {isMinWageCompliant ? '✅' : '❌'} {formatNumber(result.wage)}원 {isMinWageCompliant ? '(최저월급 이상)' : '(최저월급 미만)'}
                          </>
                        );
                      })()}</td></tr>
                      {result.wageType === 'hourly' && <>
                        <tr><th>근무형태</th><td>{(() => {
                          switch(result.hourlyWorkMode) {
                            case '1': return '주 1일';
                            case '2': return '주 2일';
                            case '3': return '주 3일';
                            case '4': return '주 4일';
                            case '5': return '주 5일';
                            case '6': return '주 6일';
                            case '7': return '주 7일';
                            default: return '-';
                          }
                        })()}</td></tr>
                        <tr><th>일일 근무시간</th><td>{dailyHours}시간</td></tr>
                        <tr><th>휴게시간(자동차감)</th><td>{result.auto ? `${Math.round(result.auto.breakMin)}분` : '-'}</td></tr>
                        <tr><th>실제 근무시간(휴게제외)</th><td>{result.auto ? Math.round(result.auto.realWorkMin/60) : '-'}시간</td></tr>
                        <tr><th>연장근로(1일)</th><td>{result.auto ? (() => {
                          const overHours = Math.round(result.auto.overMin/60);
                          const hasOvertime = overHours > 0;
                          return (
                            <>
                              {hasOvertime ? '✅ ' : ''}{overHours}시간 {hasOvertime ? '(초과수당 지급)' : ''}
                            </>
                          );
                        })() : '-'}</td></tr>
                        <tr><th>야간근로(1일)</th><td>{result.auto ? (() => {
                          const nightHours = Math.round(result.auto.nightMin/60);
                          const hasNightWork = nightHours > 0;
                          return (
                            <>
                              {hasNightWork ? '✅ ' : ''}{nightHours}시간 {hasNightWork ? '(야근수당 지급)' : ''}
                            </>
                          );
                        })() : '-'}</td></tr>
                        <tr><th>주별근무시간 합계</th><td>{result.auto ? (() => {
                          const weekHours = Math.round(result.auto.weekWorkMin/60);
                          const isJuhyuEligible = weekHours >= 15;
                          return (
                            <>
                              {isJuhyuEligible ? '✅' : '❌'} {weekHours}시간 {isJuhyuEligible ? '(주휴수당 대상)' : '(주휴수당 미대상)'}
                            </>
                          );
                        })() : '-'}</td></tr>
                        <tr><th>월별근무시간 합계</th><td>{result.auto ? Math.round(result.auto.monthWorkMin/60) : '-'}시간</td></tr>
                        <tr><th>4대보험 가입 조건</th><td style={{textAlign: 'left'}}>{result.auto ? (() => {
                          const insurance = checkInsuranceEligibility(result.auto.weekWorkMin/60, result.auto.monthWorkMin/60);
                          return (
                            <>
                              {insurance.isEligible ? '✅' : '❌'} {insurance.reason}
                            </>
                          );
                        })() : '-'}</td></tr>
                        <tr><th>월 기본급</th><td>{result.auto ? `${formatNumber(Math.round(result.auto.basePay))}원` : '-'}</td></tr>
                        <tr><th>주휴수당(월)</th><td>{result.auto ? `${formatNumber(Math.round(result.auto.juhyuPay))}원` : '-'}</td></tr>
                        <tr><th>연장근로수당(월)</th><td>{result.auto ? `${formatNumber(Math.round(result.auto.overtimePay))}원` : '-'}</td></tr>
                        <tr><th>야간근로수당(월)</th><td>{result.auto ? `${formatNumber(Math.round(result.auto.nightPay))}원` : '-'}</td></tr>
                        <tr><th>월 총 급여(상세)</th><td>{result.auto ? (() => {
                          const totalPay = Math.round(result.auto.totalPay);
                          const isOverBudget = totalPay > result.budgetNum;
                          return (
                            <span style={{ 
                              color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                              fontWeight: isOverBudget ? 'bold' : 'normal' 
                            }}>
                              {formatNumber(totalPay)}원
                              {isOverBudget ? ' (예산 초과)' : ' (예산 내)'}
                            </span>
                          );
                        })() : '-'}</td></tr>
                        {result.auto && result.auto.insurance.isEligible && (
                          <tr><th>4대보험료 (추정)</th><td>{formatNumber(Math.round(result.auto.insuranceCost))}원 (11.1241%)</td></tr>
                        )}
                        {result.auto && (
                          <tr><th>산재보험료 (추정)</th><td>{formatNumber(Math.round(result.auto.sanJaeCost))}원 (1.47%)</td></tr>
                        )}
                        {result.auto && (
                          <tr><th>회사 부담 총액 (추정)</th><td>{(() => {
                            const totalCompanyCost = Math.round(result.auto.totalCompanyCost);
                            const isOverBudget = totalCompanyCost > result.budgetNum;
                            return (
                              <span style={{ 
                                color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                                fontWeight: isOverBudget ? 'bold' : 'normal' 
                              }}>
                                {formatNumber(totalCompanyCost)}원
                                {isOverBudget ? ' (예산 초과)' : ' (예산 내)'}
                              </span>
                            );
                          })()}</td></tr>
                        )}
                      </>}
                      {result.wageType === 'monthly' && <>
                        <tr><th>근무 가능 여부</th><td>{result.canFullTime ? '✅ 풀타임(209시간/월) 고용 가능' : '❌ 최저임금 미만, 풀타임 고용 불가'}</td></tr>
                        <tr><th>주 근무시간</th><td>✅ 40시간 (주 5일 × 8시간)</td></tr>
                        <tr><th>주휴수당</th><td>✅ 포함 (주 40시간 근무)</td></tr>
                        <tr><th>연장근로</th><td>없음 (주 40시간 기준)</td></tr>
                        <tr><th>야간근로</th><td>없음 (기본 근무시간 09:00-18:00)</td></tr>
                        <tr><th>4대보험 가입 조건</th><td style={{textAlign: 'left'}}>{(() => {
                          const insurance = checkInsuranceEligibility(40, 209);
                          return (
                            <>
                              {insurance.isEligible ? '✅' : '❌'} {insurance.reason}
                            </>
                          );
                        })()}</td></tr>
                        <tr><th>산재보험료 (추정)</th><td>{formatNumber(Math.round(result.wage * 0.0147))}원 (1.47%)</td></tr>
                        <tr><th>고용보험료 (추정)</th><td>{formatNumber(Math.round(result.wage * 0.0115))}원 (1.15%)</td></tr>
                        <tr><th>국민연금 (추정)</th><td>{formatNumber(Math.round(result.wage * 0.045))}원 (4.5%)</td></tr>
                        <tr><th>건강보험 (추정)</th><td>{formatNumber(Math.round(result.wage * 0.03545))}원 (3.545%)</td></tr>
                        <tr><th>장기요양보험 (추정)</th><td>{formatNumber(Math.round(result.wage * 0.004591))}원 (0.4591%)</td></tr>
                        <tr><th>회사 부담 총액 (추정)</th><td>{(() => {
                          const totalCompanyCost = Math.round(result.wage * 1.111241);
                          const isOverBudget = totalCompanyCost > result.budgetNum;
                          return (
                            <span style={{ 
                              color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                              fontWeight: isOverBudget ? 'bold' : 'normal' 
                            }}>
                              {formatNumber(totalCompanyCost)}원
                              {isOverBudget ? ' (예산 초과)' : ' (예산 내)'}
                            </span>
                          );
                        })()}</td></tr>
                        <tr><th>월 예산 대비</th><td>{result.canFullTime ? (() => {
                          const difference = Math.round(result.budgetNum - result.wage * 1.111241);
                          const isOverBudget = difference < 0;
                          return (
                            <span style={{ 
                              color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                              fontWeight: isOverBudget ? 'bold' : 'normal' 
                            }}>
                              {isOverBudget ? `${formatNumber(Math.abs(difference))}원 초과` : `${formatNumber(difference)}원 여유`}
                            </span>
                          );
                        })() : '예산 부족'}</td></tr>
                        <tr><th>연간 예산 (추정)</th><td>{formatNumber(Math.round(result.wage * 1.111241 * 12))}원</td></tr>
                      </>}
                    </tbody>
                  </table>
                </div>
                {/* 설명란 */}
                <div className="ios-groupbox">
                  <div className="ios-card-title"><span className="ios-icon">📝</span>설명</div>
                  <div className="ios-card-content">
                    {result.wageType === 'hourly' ? (
                      <>
                        본 예산으로는 주 {(() => {
                          switch(result.hourlyWorkMode) {
                            case '1': return '1일';
                            case '2': return '2일';
                            case '3': return '3일';
                            case '4': return '4일';
                            case '5': return '5일';
                            case '6': return '6일';
                            case '7': return '7일';
                            default: return '-';
                          }
                        })()} {dailyHours}시간씩 인력 운영이 가능합니다.<br />
                        (휴게시간 {result.auto ? Math.round(result.auto.breakMin) : '-'}분 자동 차감, 실제 근무 {result.auto ? Math.round(result.auto.realWorkMin/60) : '-'}시간)<br />
                        연장근로 {result.auto ? Math.round(result.auto.overMin/60) : '-'}시간, 야간근로 {result.auto ? Math.round(result.auto.nightMin/60) : '-'}시간 포함.<br />
                        <b>월 총 급여(상세): {result.auto ? (() => {
                          const totalPay = Math.round(result.auto.totalPay);
                          const isOverBudget = totalPay > result.budgetNum;
                          return (
                            <span style={{ 
                              color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                              fontWeight: isOverBudget ? 'bold' : 'normal' 
                            }}>
                              {formatNumber(totalPay)}원
                              {isOverBudget ? ' (예산 초과)' : ' (예산 내)'}
                            </span>
                          );
                        })() : '-'}</b><br />
                        {result.auto && result.auto.insurance.isEligible ? ` + 4대보험료 ${formatNumber(Math.round(result.auto.insuranceCost))}원(11.1241%) + 산재보험료 ${formatNumber(Math.round(result.auto.sanJaeCost))}원(1.47%) = ${formatNumber(Math.round(result.auto.totalCompanyCost))}원` : result.auto ? ` + 산재보험료 ${formatNumber(Math.round(result.auto.sanJaeCost))}원(1.47%) = ${formatNumber(Math.round(result.auto.totalCompanyCost))}원` : ''}
                        <span style={{fontSize:'0.95em', color:'#888', display:'block', marginTop:'0.5em', textAlign:'left'}}>
                          산출근거: {result.auto ? `${formatNumber(Math.round(result.auto.basePay))}원 = 시급(${formatNumber(result.wage)} × ${Math.round(result.auto.monthWorkMin/60)}h)` : ''}
                          {result.auto && result.auto.juhyuPay > 0 ? ` + 주휴수당 (${formatNumber(Math.round(result.auto.juhyuPay))}원)` : ''}
                          {result.auto && result.auto.overtimePay > 0 ? ` + 연장근로수당(${formatNumber(result.wage)} × 1.5 × ${Math.round(result.auto.monthOverMin/60)}h)` : ''}
                          {result.auto && result.auto.nightPay > 0 ? ` + 야간근로수당(${formatNumber(result.wage)} × 1.5 × ${Math.round(result.auto.monthNightMin/60)}h)` : ''}
                          {result.auto ? ` = ${formatNumber(Math.round(result.auto.totalPay))}원` : ''}
                        </span>
                        {result.auto && (
                          result.auto.insurance.isEligible ? 
                            <div>※ 4대보험 의무가입 대상이므로 보험료가 추가로 발생합니다.</div> : 
                            <div>※ 4대보험 가입 조건 미충족으로 보험료 부담이 없습니다.</div>
                        )}
                        <div>※ 실제 지급액은 주휴수당, 추가수당, 세금 등으로 달라질 수 있습니다.</div>
                        <div>※ 근무시간이 많을수록 연장·야간수당이 자동으로 포함되어 총급여가 증가합니다.</div>
                      </>
                    ) : (
                      <>
                        {result.canFullTime ? (
                          <>
                            <b>✅ 풀타임 고용 가능</b><br />
                            예산 {formatNumber(result.budgetNum)}원으로 월급 {formatNumber(result.wage)}원의 풀타임 직원을 고용할 수 있습니다.<br />
                            <b>회사 부담 총액: {(() => {
                              const totalCompanyCost = Math.round(result.wage * 1.09365);
                              const isOverBudget = totalCompanyCost > result.budgetNum;
                              return (
                                <span style={{ 
                                  color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                                  fontWeight: 'bold' 
                                }}>
                                  {formatNumber(totalCompanyCost)}원/월
                                  {isOverBudget ? ' (예산 초과)' : ' (예산 내)'}
                                </span>
                              );
                            })()}</b><br />
                            (기본급 {formatNumber(result.wage)}원 + 4대보험료 {formatNumber(Math.round(result.wage * 0.111241))}원)<br />
                            <span style={{fontSize:'0.95em', color:'#888', display:'block', marginTop:'0.5em', textAlign:'left'}}>
                              산출근거: 기본급 {formatNumber(result.wage)}원 + 국민연금 4.5% + 건강보험 3.545% + 장기요양보험 0.4591% + 고용보험 1.15% + 산재보험 1.47% = {formatNumber(Math.round(result.wage * 1.111241))}원
                            </span>
                            <b>예산 여유: {(() => {
                              const difference = Math.round(result.budgetNum - result.wage * 1.111241);
                              const isOverBudget = difference < 0;
                              return (
                                <span style={{ 
                                  color: isOverBudget ? '#d32f2f' : '#2e7d32', 
                                  fontWeight: 'bold' 
                                }}>
                                  {isOverBudget ? `${formatNumber(Math.abs(difference))}원 초과` : `${formatNumber(difference)}원 여유`}/월
                                </span>
                              );
                            })()}</b><br />
                            <b>연간 예산: {formatNumber(Math.round(result.wage * 1.111241 * 12))}원</b><br />
                            <div>※ 4대보험 의무가입 대상(주 40시간 근무)이므로 보험료가 포함됩니다.</div>
                            <div>※ 4대보험료는 추정치이며, 실제 부담률은 업종과 규모에 따라 달라질 수 있습니다.</div>
                            <div>※ 주휴수당은 주 40시간 근무 시 자동으로 포함됩니다.</div>
                          </>
                        ) : (
                          <>
                            <b>❌ 풀타임 고용 불가</b><br />
                            예산 {formatNumber(result.budgetNum)}원이 최저월급 {formatNumber(MIN_MONTHLY_2025)}원보다 낮습니다.<br />
                            풀타임 고용을 위해서는 최소 {formatNumber(MIN_MONTHLY_2025)}원 이상의 예산이 필요합니다.<br />
                            <div style={{fontSize:'0.95em', color:'#888', marginTop:'0.5em', textAlign:'left'}}>
                              필요 예산: 최저월급 {formatNumber(MIN_MONTHLY_2025)}원 + 4대보험료 약 {formatNumber(Math.round(MIN_MONTHLY_2025 * 0.111241))}원 = 약 {formatNumber(Math.round(MIN_MONTHLY_2025 * 1.111241))}원
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* 막대그래프 추가 */}
                <BudgetBarChart result={result} budget={result.budgetNum} />
                {/* 근로기준법 아코디언 추가 */}
                <LaborLawAccordion />
                <div className="preview-actions" style={{marginTop:'2rem'}}>
                  <button className="nav-btn" onClick={() => setStep('budget')}>다시 계산</button>
                  <button className="nav-btn" onClick={() => navigate('/')}>홈으로</button>
                </div>
                <div style={{marginTop:'1.5rem', textAlign:'center'}}>
                  <span style={{color:'#d32f2f', fontSize:'0.98rem', fontWeight:600}}>
                    ※ 이 내용은 참고용이며 법적 효력이 없습니다.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllowanceCalculator; 