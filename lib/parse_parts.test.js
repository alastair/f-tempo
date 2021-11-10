const {parseMusicXml, parseMei} = require('./parse_parts.js');
const fs = require('fs');
const path = require('path');

describe("Parse musicxml", () => {
    it("loads a musicxml file", () => {
        const parser = new DOMParser();

        const data = fs.readFileSync( path.resolve(__dirname, './test_data/Ben_qui_si_mostra_Rore.musicxml'), 'utf-8');
        const dom = parser.parseFromString(data, "application/xml");
        const expected = [
            'e-ABaAb-a-AaaFfAAa-aFe-AAbABa-b--ABa-a--AA-d-F-aAbaaaDba-aaFdaAb-FaAb----b-A-A-AA-fFdaaAACAfADAfA-aAAaaF-b----a-aAAbA-Aaaa-ADfFcaAAbA-AaaaEfFaaB-cAa',
            'abA-AadEdaFaa-dEAaAdBAaAAfFb--AA-aaAAeBAAbABa-Af--Fe-a--A-CAbA--aaAAB-b-dFb-aaaDbAb-DfFe-A--bFfA-AAAaBA--cAAAcAAAa-AfFabAc-A-a-D--Aa-A-eaF-aaAA-fFaaA--Aa-AeaFaaAAcBc--AAaaa',
            'e-ABaA-b-CAdCbAaaAA-aaaAAAaAb-BaAAbABa-aaA--A-----Ad-a---AaaFdaE-b-dFfFac-D-f--D-A-Ae-AaABaaaEaacAB-aaB--baAD-f-FadaA--aAEdDcAaaaBBc--DeaA-aAEdDcAaaa-ADfFeAD--',
            'aEf-ACdEdC-BfFfAAaEfFeaFe-CcCdBa-D--dCdEAbcCbDfDAAdDfDAAdC-aAcB-d---Ba-CbaCBacDdaEaacDadDAAdB-d-Dc-DdCAdEdDfF-aaAcaDdCAdEdDfF-aaAcDdaAD',
        ];
        const parsed = parseMusicXml(dom.documentElement);
        expect(parsed).toEqual(expected);
    });
});

describe("Parse MEI", () => {
    it("loads an MEI file", () => {
        const parser = new DOMParser();

        const data = fs.readFileSync( path.resolve(__dirname, './test_data/Ben_qui_si_mostra_Rore.mei'), 'utf-8');
        const dom = parser.parseFromString(data, "application/xml");
        const expected = [
            'e-ABaAb-a-AaaFfAAa-aFe-AAbABa-b--ABa-a--AA-d-F-aAbaaaDba-aaFdaAb-FaAb----b-A-A-AA-fFdaaAACAfADAfA-aAAaaF-b----a-aAAbA-Aaaa-ADfFcaAAbA-AaaaEfFaaB-cAa',
            'abA-AadEdaFaa-dEAaAdBAaAAfFb--AA-aaAAeBAAbABa-Af--Fe-a--A-CAbA--aaAAB-b-dFb-aaaDbAb-DfFe-A--bFfA-AAAaBA--cAAAcAAAa-AfFabAc-A-a-D--Aa-A-eaF-aaAA-fFaaA--Aa-AeaFaaAAcBc--AAaaa',
            'e-ABaA-b-CAdCbAaaAA-aaaAAAaAb-BaAAbABa-aaA--A-----Ad-a---AaaFdaE-b-dFfFac-D-f--D-A-Ae-AaABaaaEaacAB-aaB--baAD-f-FadaA--aAEdDcAaaaBBc--DeaA-aAEdDcAaaa-ADfFeAD--',
            'aEf-ACdEdC-BfFfAAaEfFeaFe-CcCdBa-D--dCdEAbcCbDfDAAdDfDAAdC-aAcB-d---Ba-CbaCBacDdaEaacDadDAAdB-d-Dc-DdCAdEdDfF-aaAcaDdCAdEdDfF-aaAcDdaAD',
        ];
        const parsed = parseMei(dom.documentElement);
        const parsed_notes = [parsed['1'].notes, parsed['2'].notes, parsed['3'].notes, parsed['4'].notes];
        expect(parsed_notes).toEqual(expected);
    });
});