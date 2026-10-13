/**
 * FICTIONAL DMN 1.3 decision table. The simulated backend evaluates an equivalent rule set
 * (`src/mocks/riskDecision.ts`) and returns the matched rule ids, which the viewer highlights.
 * Hit policy FIRST: rules are evaluated top to bottom and the first match wins.
 */
export const RISK_DECISION_KEY = 'risk-tier';

export const riskTierDecisionXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
  xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
  id="Definitions_RiskTier" name="Risk tier (fictional)" namespace="https://example.invalid/dmn">
  <decision id="risk-tier" name="Risk tier">
    <decisionTable id="DecisionTable_RiskTier" hitPolicy="FIRST">
      <input id="Input_Pep" label="Politically exposed person">
        <inputExpression id="InputExpression_Pep" typeRef="boolean"><text>pepExposure</text></inputExpression>
      </input>
      <input id="Input_Jurisdiction" label="Jurisdiction risk">
        <inputExpression id="InputExpression_Jurisdiction" typeRef="string"><text>jurisdictionRisk</text></inputExpression>
      </input>
      <input id="Input_Volume" label="Expected annual volume">
        <inputExpression id="InputExpression_Volume" typeRef="number"><text>expectedAnnualVolume</text></inputExpression>
      </input>
      <output id="Output_Tier" label="Risk tier" name="riskTier" typeRef="string" />
      <output id="Output_Review" label="Review level" name="reviewLevel" typeRef="string" />
      <rule id="Rule_Pep">
        <description>Any politically exposed person connection</description>
        <inputEntry id="Rule_Pep_In1"><text>true</text></inputEntry>
        <inputEntry id="Rule_Pep_In2"><text>-</text></inputEntry>
        <inputEntry id="Rule_Pep_In3"><text>-</text></inputEntry>
        <outputEntry id="Rule_Pep_Out1"><text>"HIGH"</text></outputEntry>
        <outputEntry id="Rule_Pep_Out2"><text>"SENIOR"</text></outputEntry>
      </rule>
      <rule id="Rule_HighJurisdiction">
        <description>High jurisdiction risk</description>
        <inputEntry id="Rule_HighJurisdiction_In1"><text>-</text></inputEntry>
        <inputEntry id="Rule_HighJurisdiction_In2"><text>"HIGH"</text></inputEntry>
        <inputEntry id="Rule_HighJurisdiction_In3"><text>-</text></inputEntry>
        <outputEntry id="Rule_HighJurisdiction_Out1"><text>"HIGH"</text></outputEntry>
        <outputEntry id="Rule_HighJurisdiction_Out2"><text>"SENIOR"</text></outputEntry>
      </rule>
      <rule id="Rule_HighVolume">
        <description>Large expected volume</description>
        <inputEntry id="Rule_HighVolume_In1"><text>-</text></inputEntry>
        <inputEntry id="Rule_HighVolume_In2"><text>-</text></inputEntry>
        <inputEntry id="Rule_HighVolume_In3"><text>&gt; 5000000</text></inputEntry>
        <outputEntry id="Rule_HighVolume_Out1"><text>"MEDIUM"</text></outputEntry>
        <outputEntry id="Rule_HighVolume_Out2"><text>"STANDARD"</text></outputEntry>
      </rule>
      <rule id="Rule_MediumJurisdiction">
        <description>Medium jurisdiction risk</description>
        <inputEntry id="Rule_MediumJurisdiction_In1"><text>-</text></inputEntry>
        <inputEntry id="Rule_MediumJurisdiction_In2"><text>"MEDIUM"</text></inputEntry>
        <inputEntry id="Rule_MediumJurisdiction_In3"><text>-</text></inputEntry>
        <outputEntry id="Rule_MediumJurisdiction_Out1"><text>"MEDIUM"</text></outputEntry>
        <outputEntry id="Rule_MediumJurisdiction_Out2"><text>"STANDARD"</text></outputEntry>
      </rule>
      <rule id="Rule_Default">
        <description>Everything else</description>
        <inputEntry id="Rule_Default_In1"><text>-</text></inputEntry>
        <inputEntry id="Rule_Default_In2"><text>-</text></inputEntry>
        <inputEntry id="Rule_Default_In3"><text>-</text></inputEntry>
        <outputEntry id="Rule_Default_Out1"><text>"LOW"</text></outputEntry>
        <outputEntry id="Rule_Default_Out2"><text>"STANDARD"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_RiskTier" dmnElementRef="risk-tier">
        <dc:Bounds height="80" width="180" x="160" y="100" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>
`;
