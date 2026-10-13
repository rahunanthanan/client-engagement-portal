/**
 * FICTIONAL BPMN 2.0 process for a client request. Element ids are referenced by the simulated
 * backend (`currentActivityId`) so the viewer can highlight where a request is.
 */
export const CLIENT_REQUEST_PROCESS_KEY = 'client-request-process';

export const PROCESS_ACTIVITY_LABELS: Record<string, string> = {
  StartEvent_Submitted: 'Request started',
  Task_CaptureRequest: 'Capture request (Client Advisor)',
  Task_RiskDecision: 'Evaluate risk tier (decision table)',
  Task_OperationsReview: 'Operations review',
  Gateway_Outcome: 'Review outcome',
  Task_Fulfil: 'Activate client (simulated)',
  End_Approved: 'Completed',
  End_Rejected: 'Rejected',
};

export const clientRequestProcessXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_ClientRequest" targetNamespace="https://example.invalid/bpmn">
  <bpmn:process id="client-request-process" name="Client request (fictional)" isExecutable="false">
    <bpmn:startEvent id="StartEvent_Submitted" name="Request started">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_CaptureRequest" name="Capture request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:incoming>Flow_Returned</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:businessRuleTask id="Task_RiskDecision" name="Evaluate risk tier">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:userTask id="Task_OperationsReview" name="Operations review">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_Outcome" name="Outcome?">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_Approved</bpmn:outgoing>
      <bpmn:outgoing>Flow_Rejected</bpmn:outgoing>
      <bpmn:outgoing>Flow_Returned</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="Task_Fulfil" name="Activate client (simulated)">
      <bpmn:incoming>Flow_Approved</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="End_Approved" name="Completed">
      <bpmn:incoming>Flow_5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_Rejected" name="Rejected">
      <bpmn:incoming>Flow_Rejected</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_Submitted" targetRef="Task_CaptureRequest" />
    <bpmn:sequenceFlow id="Flow_2" name="Submitted" sourceRef="Task_CaptureRequest" targetRef="Task_RiskDecision" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_RiskDecision" targetRef="Task_OperationsReview" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_OperationsReview" targetRef="Gateway_Outcome" />
    <bpmn:sequenceFlow id="Flow_Approved" name="Approved" sourceRef="Gateway_Outcome" targetRef="Task_Fulfil">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${outcome == "APPROVE"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Rejected" name="Rejected" sourceRef="Gateway_Outcome" targetRef="End_Rejected">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${outcome == "REJECT"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Returned" name="Returned" sourceRef="Gateway_Outcome" targetRef="Task_CaptureRequest">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${outcome == "RETURN"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_Fulfil" targetRef="End_Approved" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="client-request-process">
      <bpmndi:BPMNShape id="StartEvent_Submitted_di" bpmnElement="StartEvent_Submitted">
        <dc:Bounds x="152" y="202" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="131" y="245" width="78" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_CaptureRequest_di" bpmnElement="Task_CaptureRequest">
        <dc:Bounds x="240" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RiskDecision_di" bpmnElement="Task_RiskDecision">
        <dc:Bounds x="410" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_OperationsReview_di" bpmnElement="Task_OperationsReview">
        <dc:Bounds x="570" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Outcome_di" bpmnElement="Gateway_Outcome" isMarkerVisible="true">
        <dc:Bounds x="730" y="195" width="50" height="50" />
        <bpmndi:BPMNLabel><dc:Bounds x="790" y="250" width="50" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Fulfil_di" bpmnElement="Task_Fulfil">
        <dc:Bounds x="840" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Approved_di" bpmnElement="End_Approved">
        <dc:Bounds x="1002" y="202" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="993" y="245" width="54" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Rejected_di" bpmnElement="End_Rejected">
        <dc:Bounds x="842" y="322" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="837" y="365" width="46" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="220" /><di:waypoint x="240" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="220" /><di:waypoint x="410" y="220" />
        <bpmndi:BPMNLabel><dc:Bounds x="352" y="202" width="56" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="520" y="220" /><di:waypoint x="570" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="680" y="220" /><di:waypoint x="730" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Approved_di" bpmnElement="Flow_Approved">
        <di:waypoint x="780" y="220" /><di:waypoint x="840" y="220" />
        <bpmndi:BPMNLabel><dc:Bounds x="785" y="202" width="50" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Rejected_di" bpmnElement="Flow_Rejected">
        <di:waypoint x="755" y="245" /><di:waypoint x="755" y="340" /><di:waypoint x="842" y="340" />
        <bpmndi:BPMNLabel><dc:Bounds x="764" y="322" width="48" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Returned_di" bpmnElement="Flow_Returned">
        <di:waypoint x="755" y="195" /><di:waypoint x="755" y="120" /><di:waypoint x="295" y="120" /><di:waypoint x="295" y="180" />
        <bpmndi:BPMNLabel><dc:Bounds x="500" y="102" width="50" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="950" y="220" /><di:waypoint x="1002" y="220" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
