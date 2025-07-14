import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import ContractForm from './ContractForm';
import ContractPreview from './ContractPreview';
import AllowanceCalculator from './AllowanceCalculator';
import QRCode from 'react-qr-code';

function Home() {
  const navigate = useNavigate();
  
  return (
    <div className="home-container dark:bg-gray-900">
      <div className="home-content">
        {/* Hero Section */}
        <div className="hero-section">
          <h1 className="hero-title dark:text-gray-100">
            사장님은 법대로</h1>
          <p className="hero-subtitle dark:text-gray-300">
            곧 직원쓸 예정인, 초보 사장님의 법 잘알 도우미</p>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="action-button primary dark:bg-gray-800 dark:text-blue-400"
            onClick={() => navigate('/contract')}
          >
            <span className="button-icon">📄</span>
            <span className="button-text">
              <span className="button-title dark:text-blue-300">근로계약서 만들기</span>
              <span className="button-description dark:text-gray-300">법적 안전을 위한 맞춤형 계약서</span>
            </span>
            <span className="button-arrow">→</span>
          </button>
          
          <button 
            className="action-button secondary dark:bg-gray-800 dark:text-green-300"
            onClick={() => navigate('/allowance-menu')}
          >
            <span className="button-icon">💰</span>
            <span className="button-text">
              <span className="button-title dark:text-green-300">직원 뽑으려면 얼마나 들까?</span>
              <span className="button-description dark:text-gray-300">정확한 임금 계산 도구</span>
            </span>
            <span className="button-arrow">→</span>
          </button>
        </div>

        {/* QR코드: home-footer의 글귀 바로 위에 중앙 배치 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 0 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #eee' }}>
            <QRCode value="https://whimsical-raindrop-cf7019.netlify.app/" size={88} level="L" />
            <span style={{ fontSize: 12, color: '#666', marginTop: 8 }}>외부 배포 바로가기</span>
          </div>
        </div>
        {/* Footer */}
        <div className="home-footer">
          <p className="footer-text">신뢰할 수 있는 비즈니스 파트너</p>
        </div>
      </div>
    </div>
  );
}

function AllowanceMenu() {
  const navigate = useNavigate();
  
  return (
    <div className="contract-form-page">
      <div className="contract-form-container">
        <div className="form-header">
          <button className="back-btn" onClick={() => navigate('/')}>홈</button>
          <div className="form-title">직원 뽑으려면 얼마나 들까?</div>
          <div className="header-spacer" />
        </div>
        <div className="step-content">
          <div className="step-container">
            <div className="step-header">
              <div className="step-title">계산 방식을 선택하세요</div>
              <div className="step-description">원하시는 계산 방식을 선택하여 정확한 임금 계산을 도와드립니다.</div>
            </div>
            
            <div className="allowance-menu-options" style={{marginTop: 32}}>
              <button 
                className="allowance-menu-option"
                onClick={() => navigate('/allowance/budget')}
              >
                <div className="option-number">1</div>
                <div className="option-content">
                  <div className="option-title">얼마 정도 있으면 될까?</div>
                  <div className="option-description">급여 뿐만 아니라, 4대 보험료, 주휴수당까지 다 따져보자</div>
                </div>
                <div className="option-arrow">→</div>
              </button>
              
              <button 
                className="allowance-menu-option"
                onClick={() => navigate('/allowance/monthly')}
              >
                <div className="option-number">2</div>
                <div className="option-content">
                  <div className="option-title">정규직(계약직) 인건비 계산</div>
                  <div className="option-description">월 단위 임금 계산 및 법적 검증</div>
                </div>
                <div className="option-arrow">→</div>
              </button>
              
              <button 
                className="allowance-menu-option"
                onClick={() => navigate('/allowance/hourly')}
              >
                <div className="option-number">3</div>
                <div className="option-content">
                  <div className="option-title">파트타임(시급) 인건비 계산</div>
                  <div className="option-description">시간 단위 임금 계산 및 수당 산정</div>
                </div>
                <div className="option-arrow">→</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contract" element={<ContractForm />} />
        <Route path="/contract-preview" element={<ContractPreview />} />
        <Route path="/allowance-menu" element={<AllowanceMenu />} />
        <Route path="/allowance" element={<AllowanceCalculator />} />
        <Route path="/allowance/monthly" element={<AllowanceCalculator />} />
        <Route path="/allowance/hourly" element={<AllowanceCalculator />} />
        <Route path="/allowance/budget" element={<AllowanceCalculator />} />
      </Routes>
    </Router>
  );
}

export default App;
