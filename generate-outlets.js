// Script to generate complete outlet credentials from Google Sheets data
const outletCodes = [
    'JKJSTT1', 'JKJSVR1', 'JKJBTM1', 'JKJSBZ1', 'BTTSGV1', 'BTTSSU1', 'JKJUSK1', 'BTTSB91', 'BTTSVS1', 'BTTGBI1',
    'BTTSGR1', 'JKJSTB1', 'JKJSKC1', 'JKJBGV1', 'JKJPMB1', 'BTTGBW1', 'BTTSB21', 'JKJSRR1', 'JKJSGH1', 'JBBSOC1',
    'JBBGCV1', 'JBDPAU1', 'JBDPMR1', 'JBBSMT1', 'BTTGEK1', 'JBDPSW1', 'JKJTTH1', 'JKJSRD1', 'JKJBRS1', 'JBBGCC1',
    'JKJBKB1', 'JKJPDA1', 'JBBSJB1', 'BTTSRF1', 'JKJUSI1', 'JBBGRC1', 'JKJSTS1', 'JBBSTR1', 'BTTSRG1', 'BTTGSG1',
    'JKJPMS1', 'JKJBDK1', 'BTTSRC1', 'JKJUBR1', 'JBBGBR1', 'JKJSPI1', 'JKJTPL1', 'JKJTLB1', 'JKJUTG1', 'JKJSRS1',
    'BTTGBR1', 'JBBSSR1', 'JBBGWU1', 'JKJSRM1', 'BTTSBB1', 'JBBSKP1', 'JKJBHI1', 'JBBSGI1', 'BTTGPS1', 'JKJUWB1',
    'JBBSGW1', 'BTTGPP1', 'JKJSKR1', 'JKJPSB1', 'JKJBHL1', 'JKJSBI1', 'JBBGLW1', 'JKJUPI1', 'JKJBCS1', 'JBBSCC1',
    'BTTGCR1', 'JKJSMP1', 'JKJUGK1', 'JKJPTR1', 'JKJSTM1', 'JKJTPD1', 'JBBGWC1', 'BTTGGB1', 'JKJUGB1', 'JKJUGN1',
    'JKJPMP1', 'JBBSLH1', 'BTTGKS1', 'JBBGBD1', 'JBBSJM1', 'JKJBSC1', 'JKJBPL1', 'BTTSWS1', 'BTTGPB1', 'JKJSKB1',
    'JKJSPR1', 'JBBGPS1', 'JBBGTC1', 'JBDPRK1', 'JKJTMM1', 'JBBSKH1', 'BTTGLK1', 'BTTSDL1', 'JKJUMJ1'
];

// Generate outlet credentials object
const outletCredentials = {};
outletCodes.forEach((code, index) => {
    outletCredentials[code] = {
        password: 'Alpro@123',
        outletName: `APOTEK ALPRO ${code}`, // Generic name, could be enhanced with real names
        am: 'SYSTEM AM' // Generic AM assignment
    };
});

console.log('const outletCredentials = ', JSON.stringify(outletCredentials, null, 4));