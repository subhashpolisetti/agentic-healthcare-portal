/* Canvas composition */

const W = 1440, H = 1080;

const App = () => (
  <DesignCanvas>
    <DCSection id="system" title="00 · Design System" subtitle="Tokens, type, components — ready to drop into React">
      <DCArtboard id="tokens" label="Tokens reference" width={1200} height={900}><TokensCard/></DCArtboard>
    </DCSection>

    <DCSection id="auth" title="01 · Authentication" subtitle="Split editorial layout · trust + speed at first glance">
      <DCArtboard id="signin" label="Sign in · returning" width={W} height={H}><AuthScreen mode="signin"/></DCArtboard>
      <DCArtboard id="signup" label="Sign up · role select" width={W} height={H}><AuthScreen mode="signup"/></DCArtboard>
    </DCSection>

    <DCSection id="patient-book" title="02 · Patient · Book Appointment"
      subtitle="Four steps · symptom intake → AI rec → ranked doctors → booking modal">
      <DCArtboard id="p-step1" label="Step 1 · Describe symptoms"    width={W} height={H}><PatientBook_Step1/></DCArtboard>
      <DCArtboard id="p-step2" label="Step 2 · Agent 01 analysing"   width={W} height={H}><PatientBook_Step2_Loading/></DCArtboard>
      <DCArtboard id="p-step3" label="Step 3 · Ranked doctors"       width={W} height={H}><PatientBook_Step3_Results/></DCArtboard>
      <DCArtboard id="p-step4" label="Step 4 · Booking modal"        width={W} height={H}><PatientBook_Step4_BookingModal/></DCArtboard>
    </DCSection>

    <DCSection id="patient-appts" title="03 · Patient · My Appointments"
      subtitle="Status timeline with Agent 06 post-visit nudges">
      <DCArtboard id="p-appts" label="Care timeline" width={W} height={H}><PatientAppointments/></DCArtboard>
    </DCSection>

    <DCSection id="doctor" title="04 · Doctor Dashboard"
      subtitle="Five-tab workflow · Clinical → Schedule → Admitted → Discharged → No-Show">
      <DCArtboard id="d-tab1" label="Tab 1 · Clinical Analysis"        width={W} height={H}><Doctor_Tab1_Clinical/></DCArtboard>
      <DCArtboard id="d-tab2" label="Tab 2 · Patient Schedule"         width={W} height={H}><Doctor_Tab2_Schedule/></DCArtboard>
      <DCArtboard id="d-tab3" label="Tab 3 · Admitted + Agent 05"      width={W} height={H}><Doctor_Tab3_Admitted/></DCArtboard>
      <DCArtboard id="d-tab4" label="Tab 4 · Discharged + Agent 06"    width={W} height={H}><Doctor_Tab4_Discharged/></DCArtboard>
      <DCArtboard id="d-tab5" label="Tab 5 · No-Show Risk + Agent 03"  width={W} height={H}><Doctor_Tab5_NoShow/></DCArtboard>
    </DCSection>

    <DCSection id="vitals" title="05 · Emergency Vitals Monitor"
      subtitle="Real-time WebSocket · Agent 04 surfaces clinical alerts">
      <DCArtboard id="vitals" label="Live monitor · critical state" width={W} height={H}><VitalsMonitor/></DCArtboard>
    </DCSection>

    <DCPostIt top={300} right={60} rotate={3} width={210}>
      ✦ Six AI agents are tagged with monospace AGENT&nbsp;0N labels &amp; a violet hairline — easy
      to spot across every screen.
    </DCPostIt>
    <DCPostIt top={1140} right={80} rotate={-2} width={220}>
      Click any artboard's ⤢ icon to enter focus mode · ← / → to step through the flow.
    </DCPostIt>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
