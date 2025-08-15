# OKR Phoenix Project - Transaction Improvement Dashboard

A comprehensive OKR (Objectives and Key Results) tracking system for Apotek Alpro's Phoenix Project, focused on transaction improvement across all pharmacy outlets.

## 🎯 Features

### Authentication & Access Control
- **Outlet Login**: Individual outlet access with outlet code + password
- **HQ Login**: Area Manager and Admin access with email + password
- **Role-based Permissions**: 
  - Outlet users see only their data
  - Area Managers see assigned outlets
  - Admins see all outlets

### Performance Tracking
- **Revenue & Transaction Tracking**: Monthly performance with 3-term breakdown
  - Term 1: 1st-10th of month
  - Term 2: 11th-20th of month  
  - Term 3: 21st-30th/31st of month
- **Baseline Comparison**: Set monthly baselines for growth tracking
- **Smart Forecasting**: Fair comparison system that forecasts partial data to full month
- **Growth Indicators**: Visual up/down indicators with percentage growth

### OKR Management
- **Phoenix Project Templates**: Pre-built OKR templates for transaction improvement
- **Interactive Progress Tracking**: Real-time progress based on completed action plans
- **Comment System**: Team collaboration on action plans
- **File Upload**: Documentation support for progress tracking

### Dashboard Features
- **Compact Card Layout**: 3-4 outlet cards per row for efficient viewing
- **Real-time Data**: Live performance metrics integrated with OKR cards
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data Storage**: Google Sheets integration + LocalStorage
- **Authentication**: Session-based with Google Sheets credentials
- **UI Framework**: Custom responsive grid system
- **Charts**: Built-in progress bars and growth indicators

## 📊 Data Integration

### Google Sheets Integration
- **Outlet Login Sheet**: Column A (outlet codes) + Column D (passwords)
- **HQ Login Sheet**: Column B (emails) + Column H (passwords)  
- **Real-time Sync**: Live data from Google Sheets
- **97 Outlet Codes**: Complete integration with all pharmacy locations

### Supported Outlet Codes
```
JKJSTT1, JKJSVR1, JKJBTM1, JKJSBZ1, BTTSGV1, BTTSSU1, JKJUSK1, 
BTTSB91, BTTSVS1, BTTGBI1, BTTSGR1, JKJSTB1, JKJSKC1, JKJBGV1, 
JKJPMB1, BTTGBW1, BTTSB21, JKJSRR1, JKJSGH1, JBBSOC1...
(Total: 97 outlets)
```

## 🔐 Login Credentials

### Outlet Access
- **Format**: Outlet Code / Password
- **Example**: `BTTGBI1` / `Alpro@123`
- **Access**: Single outlet view only

### HQ Access  
- **Area Managers**: Email / Password (see assigned outlets only)
- **System Admin**: `khoo.ziyu@apotekalpro.id` / `Alpro@123` (full access)

## 📱 Usage Guide

### For Outlet Users
1. Login with your outlet code and password
2. View your outlet's OKR dashboard
3. Enter revenue and transaction data by terms
4. Set baseline for growth comparison
5. Manage OKR progress and action plans

### For Area Managers
1. Login with your email and password
2. View all assigned outlets
3. Monitor performance across your region
4. Access detailed OKR progress for each outlet

### For Administrators
1. Full system access
2. View all outlets and performance data
3. System-wide analytics and reporting
4. User management capabilities

## 🎨 Smart Features

### Fair Comparison System
- **Problem**: Comparing partial month data (2 terms) vs full month baseline isn't fair
- **Solution**: System forecasts partial data to full month for accurate comparison
- **Example**: Term 1: 18M → Forecast: 54M (18M × 3) vs 50M baseline = +8% growth

### Responsive Card Layout
- **Desktop**: 3-4 cards per row (280px min width, 320px max)
- **Tablet**: 2-3 cards per row
- **Mobile**: 1-2 cards per row
- **Performance Integration**: Revenue and transaction data shown in each card

## 🚀 Deployment

This application can be deployed to:
- **GitHub Pages**: Static hosting with GitHub integration
- **Netlify**: Automatic deployment from GitHub
- **Vercel**: Zero-config deployment
- **Any Static Host**: Pure HTML/CSS/JS application

## 🔧 Configuration

### Environment Setup
1. Update Google Sheets URLs in configuration
2. Configure authentication endpoints
3. Set up data refresh intervals
4. Customize outlet codes and names

### Data Sources
- **Outlet Credentials**: Google Sheets with 97 outlet codes
- **HQ Credentials**: Area Manager and Admin access
- **Performance Data**: Stored in browser LocalStorage with Google Sheets sync
- **OKR Templates**: Phoenix Project transaction improvement templates

## 📈 Analytics & Reporting

### Key Metrics Tracked
- **Revenue Growth**: Month-over-month with baseline comparison
- **Transaction Volume**: Count and growth tracking
- **OKR Progress**: Completion rates and action plan status
- **Outlet Performance**: Individual and comparative analytics

### Visual Indicators
- **Growth Arrows**: ↗ for positive, ↘ for negative growth
- **Color Coding**: Green (good), Orange (moderate), Red (critical)
- **Progress Bars**: Real-time OKR completion status
- **Forecasting**: Smart projections with clear indicators

## 🛡️ Security

- **Session Management**: Secure login with session storage
- **Permission Validation**: Server-side access control
- **Data Encryption**: Secure credential handling
- **Logout Protection**: Clean session termination

## 📞 Support

For technical support or feature requests, contact the development team or create an issue in this repository.

---

**Built for Apotek Alpro's Phoenix Project - Driving Transaction Improvement Across All Outlets** 🚀