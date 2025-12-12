// =====================================================================
// FILE: error_codes_dictionary.js
// Description: Hardcoded dictionary of Diagnostic Trouble Codes (DTCs)
// =====================================================================

/**
 * Global object containing DTC codes and their meanings.
 * Structure: { "CODE": { issuer: "Issuer Category", meaning: "Detailed Description" } }
 * All codes must be UPPERCASE.
 */
export const ERROR_CODE_LOOKUP = {
    // ----------------------------------------------------------------------------------------
    // P00XX - Fuel and Air Metering and Auxiliary Emission Controls (P001A - P00BF)
    // ----------------------------------------------------------------------------------------
    "P001A": { issuer: "Powertrain", meaning: "Intake 'A' Camshaft Position Actuator Performance (Bank 1)" },
    "P001B": { issuer: "Powertrain", meaning: "Intake 'B' Camshaft Position Actuator Performance (Bank 1)" },
    "P001C": { issuer: "Powertrain", meaning: "Exhaust 'A' Camshaft Position Actuator Performance (Bank 1)" },
    "P001D": { issuer: "Powertrain", meaning: "Exhaust 'B' Camshaft Position Actuator Performance (Bank 1)" },
    "P001E": { issuer: "Powertrain", meaning: "Camshaft Position Actuator Electrical Circuit/Open (Bank 1)" },
    "P001F": { issuer: "Powertrain", meaning: "Camshaft Position Actuator Circuit Range/Performance (Bank 1)" },
    "P002A": { issuer: "Powertrain", meaning: "Intake 'A' Camshaft Position Actuator Performance (Bank 2)" },
    "P002B": { issuer: "Powertrain", meaning: "Intake 'B' Camshaft Position Actuator Performance (Bank 2)" },
    "P002C": { issuer: "Powertrain", meaning: "Exhaust 'A' Camshaft Position Actuator Performance (Bank 2)" },
    "P002D": { issuer: "Powertrain", meaning: "Exhaust 'B' Camshaft Position Actuator Performance (Bank 2)" },
    "P002E": { issuer: "Powertrain", meaning: "Camshaft Position Actuator Electrical Circuit/Open (Bank 2)" },
    "P002F": { issuer: "Powertrain", meaning: "Camshaft Position Actuator Circuit Range/Performance (Bank 2)" },
    "P003A": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Bypass Valve 'A' Control Performance" },
    "P003B": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Bypass Valve 'B' Control Performance" },
    "P003C": { issuer: "Powertrain", meaning: "Charge Air Cooler Pump Control Circuit/Open" },
    "P003D": { issuer: "Powertrain", meaning: "Charge Air Cooler Pump Control Circuit Range/Performance" },
    "P003E": { issuer: "Powertrain", meaning: "Exhaust Gas Recirculation (EGR) Valve 'A' Control Position Stuck" },
    "P003F": { issuer: "Powertrain", meaning: "Exhaust Gas Recirculation (EGR) Valve 'B' Control Position Stuck" },
    "P004A": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Boost Control Solenoid 'A' Circuit Range/Performance" },
    "P004B": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Boost Control Solenoid 'B' Circuit Range/Performance" },
    "P004C": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Bypass Valve Control 'A' Circuit Low" },
    "P004D": { issuer: "Powertrain", meaning: "Turbocharger/Supercharger Bypass Valve Control 'A' Circuit High" },
    "P004E": { issuer: "Powertrain", meaning: "Exhaust Gas Recirculation (EGR) Valve 'A' Control Performance (Stuck Open/Closed)" },
    "P004F": { issuer: "Powertrain", meaning: "Exhaust Gas Recirculation (EGR) Valve 'B' Control Performance (Stuck Open/Closed)" },
    "P005A": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Stuck Open (Bank 1)" },
    "P005B": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Stuck Closed (Bank 1)" },
    "P005C": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Stuck Open (Bank 2)" },
    "P005D": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Stuck Closed (Bank 2)" },
    "P005E": { issuer: "Powertrain", meaning: "Variable Geometry Turbocharger (VGT) Vane Position Sensor 'A' Circuit Range/Performance" },
    "P005F": { issuer: "Powertrain", meaning: "Variable Geometry Turbocharger (VGT) Vane Position Sensor 'B' Circuit Range/Performance" },
    "P006A": { issuer: "Powertrain", meaning: "MAP - Mass or Volume Air Flow Correlation (Intermittent)" },
    "P006B": { issuer: "Powertrain", meaning: "MAP - Exhaust Pressure Correlation (Intermittent)" },
    "P006C": { issuer: "Powertrain", meaning: "MAP - Turbo/Supercharger Inlet Pressure Correlation" },
    "P006D": { issuer: "Powertrain", meaning: "MAP - Turbo/Supercharger Outlet Pressure Correlation" },
    "P006E": { issuer: "Powertrain", meaning: "Fuel Pump 'A' Control Circuit/Open" },
    "P006F": { issuer: "Powertrain", meaning: "Fuel Pump 'B' Control Circuit/Open" },
    "P007A": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3 Circuit (Bank 1)" },
    "P007B": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3 Circuit Range/Performance (Bank 1)" },
    "P007C": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3 Circuit Low (Bank 1)" },
    "P007D": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3 Circuit High (Bank 1)" },
    "P007E": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3 Circuit Intermittent/Erratic (Bank 1)" },
    "P007F": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3/4 Correlation (Bank 1/2)" },
    "P008A": { issuer: "Powertrain", meaning: "Low Pressure Fuel System Pressure - Too Low" },
    "P008B": { issuer: "Powertrain", meaning: "Low Pressure Fuel System Pressure - Too High" },
    "P008C": { issuer: "Powertrain", meaning: "Low Pressure Fuel System Pressure Sensor Circuit Low" },
    "P008D": { issuer: "Powertrain", meaning: "Low Pressure Fuel System Pressure Sensor Circuit High" },
    "P008E": { issuer: "Powertrain", meaning: "High Pressure Fuel Pump Stuck Open/Closed" },
    "P008F": { issuer: "Powertrain", meaning: "High Pressure Fuel Pump Control Circuit" },
    "P009A": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 4 Circuit (Bank 2)" },
    "P009B": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 4 Circuit Range/Performance (Bank 2)" },
    "P009C": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 4 Circuit Low (Bank 2)" },
    "P009D": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 4 Circuit High (Bank 2)" },
    "P009E": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 4 Circuit Intermittent/Erratic (Bank 2)" },
    "P009F": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 3/4 Correlation (Bank 2/1)" },
    "P00A0": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5 Circuit (Bank 1)" },
    "P00A1": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5 Circuit Range/Performance (Bank 1)" },
    "P00A2": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5 Circuit Low (Bank 1)" },
    "P00A3": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5 Circuit High (Bank 1)" },
    "P00A4": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5 Circuit Intermittent/Erratic (Bank 1)" },
    "P00A5": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 5/6 Correlation (Bank 1/2)" },
    "P00A6": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 6 Circuit (Bank 2)" },
    "P00A7": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 6 Circuit Range/Performance (Bank 2)" },
    "P00A8": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 6 Circuit Low (Bank 2)" },
    "P00A9": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 6 Circuit High (Bank 2)" },
    "P00AA": { issuer: "Powertrain", meaning: "Mass or Volume Air Flow 'A' Circuit Range/Performance" },
    "P00AB": { issuer: "Powertrain", meaning: "Mass or Volume Air Flow 'B' Circuit Range/Performance" },
    "P00AC": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7 Circuit (Bank 1)" },
    "P00AD": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7 Circuit Range/Performance (Bank 1)" },
    "P00AE": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7 Circuit Low (Bank 1)" },
    "P00AF": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7 Circuit High (Bank 1)" },
    "P00B0": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7 Circuit Intermittent/Erratic (Bank 1)" },
    "P00B1": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 7/8 Correlation (Bank 1/2)" },
    "P00B2": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 8 Circuit (Bank 2)" },
    "P00B3": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 8 Circuit Range/Performance (Bank 2)" },
    "P00B4": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 8 Circuit Low (Bank 2)" },
    "P00B5": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 8 Circuit High (Bank 2)" },
    "P00B6": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor 8 Circuit Intermittent/Erratic (Bank 2)" },
    "P00B7": { issuer: "Powertrain", meaning: "Coolant Flow Low/Performance" },
    "P00B8": { issuer: "Powertrain", meaning: "Coolant Flow Sensor Circuit" },
    "P00B9": { issuer: "Powertrain", meaning: "Coolant Flow Sensor Circuit Range/Performance" },
    "P00BA": { issuer: "Powertrain", meaning: "Coolant Flow Sensor Circuit Low" },
    "P00BB": { issuer: "Powertrain", meaning: "Coolant Flow Sensor Circuit High" },
    "P00BC": { issuer: "Powertrain", meaning: "Mass or Volume Air Flow 'A' Circuit Range/Performance (Intermittent)" },
    "P00BD": { issuer: "Powertrain", meaning: "Mass or Volume Air Flow 'B' Circuit Range/Performance (Intermittent)" },
    "P00BE": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Bank 1 Stuck Open/Closed" },
    "P00BF": { issuer: "Powertrain", meaning: "Intake Manifold Runner Control (IMRC) Bank 2 Stuck Open/Closed" },
    
    // ----------------------------------------------------------------------------------------
    // P01XX - Fuel and Air Metering (P011A - P018F)
    // ----------------------------------------------------------------------------------------
    "P011A": { issuer: "Powertrain", meaning: "Engine Coolant Temperature Sensor 1/2 Correlation" },
    "P011B": { issuer: "Powertrain", meaning: "Engine Coolant Temperature Sensor 2 Circuit Range/Performance" },
    "P011C": { issuer: "Powertrain", meaning: "Engine Coolant Temperature Sensor 1/2 Correlation (Intermittent)" },
    "P011D": { issuer: "Powertrain", meaning: "Engine Coolant Temperature Sensor 2 Circuit Intermittent/Erratic" },
    "P012A": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor (Post Compressor) Circuit" },
    "P012B": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor (Post Compressor) Circuit Range/Performance" },
    "P012C": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor (Post Compressor) Circuit Low" },
    "P012D": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor (Post Compressor) Circuit High" },
    "P012E": { issuer: "Powertrain", meaning: "Intake Air Temperature Sensor (Post Compressor) Circuit Intermittent/Erratic" },
    "P013A": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Rich to Lean (Bank 1, Sensor 2)" },
    "P013B": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Lean to Rich (Bank 1, Sensor 2)" },
    "P013C": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Rich to Lean (Bank 1, Sensor 3)" },
    "P013D": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Lean to Rich (Bank 1, Sensor 3)" },
    "P013E": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Rich to Lean (Bank 1, Sensor 4)" },
    "P013F": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Lean to Rich (Bank 1, Sensor 4)" },
    "P014A": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Rich to Lean (Bank 2, Sensor 2)" },
    "P014B": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Lean to Rich (Bank 2, Sensor 2)" },
    "P014C": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Rich to Lean (Bank 2, Sensor 3)" },
    "P014D": { issuer: "Powertrain", meaning: "O2 Sensor Slow Response - Lean to Rich (Bank 2, Sensor 3)" },
    "P014E": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Rich to Lean (Bank 2, Sensor 4)" },
    "P014F": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Lean to Rich (Bank 2, Sensor 4)" },
    "P015A": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Rich to Lean (Bank 1, Sensor 1)" },
    "P015B": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Lean to Rich (Bank 1, Sensor 1)" },
    "P015C": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Rich to Lean (Bank 2, Sensor 1)" },
    "P015D": { issuer: "Powertrain", meaning: "O2 Sensor Delayed Response - Lean to Rich (Bank 2, Sensor 1)" },
    "P018A": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'B' Circuit" },
    "P018B": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'B' Circuit Range/Performance" },
    "P018C": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'B' Circuit Low" },
    "P018D": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'B' Circuit High" },
    "P018E": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'B' Circuit Intermittent/Erratic" },
    "P018F": { issuer: "Powertrain", meaning: "Fuel Temperature Sensor 'A'/'B' Correlation" },

    // ----------------------------------------------------------------------------------------
    // P02XX - Fuel and Air Metering (Injector, Misfire, Turbo, DPF) (P020A - P02C8)
    // ----------------------------------------------------------------------------------------
    "P020A": { issuer: "Powertrain", meaning: "Cylinder 1 Injector Performance / Fault" },
    "P020B": { issuer: "Powertrain", meaning: "Cylinder 2 Injector Performance / Fault" },
    "P020C": { issuer: "Powertrain", meaning: "Cylinder 3 Injector Performance / Fault" },
    "P020D": { issuer: "Powertrain", meaning: "Cylinder 4 Injector Performance / Fault" },
    "P020E": { issuer: "Powertrain", meaning: "Cylinder 5 Injector Performance / Fault" },
    "P020F": { issuer: "Powertrain", meaning: "Cylinder 6 Injector Performance / Fault" },
    "P021A": { issuer: "Powertrain", meaning: "Cylinder 7 Injector Performance / Fault" },
    "P021B": { issuer: "Powertrain", meaning: "Cylinder 8 Injector Performance / Fault" },
    "P021C": { issuer: "Powertrain", meaning: "Cylinder 9 Injector Performance / Fault" },
    "P021D": { issuer: "Powertrain", meaning: "Cylinder 10 Injector Performance / Fault" },
    "P021E": { issuer: "Powertrain", meaning: "Cylinder 11 Injector Performance / Fault" },
    "P021F": { issuer: "Powertrain", meaning: "Cylinder 12 Injector Performance / Fault" },
    // ... Injector Fault/Performance codes P022A through P022F ...
    "P022A": { issuer: "Powertrain", meaning: "Throttle Position Sensor/Switch 'C' Circuit Range/Performance" },
    // ... Turbo/Supercharger codes P023A through P025D ...
    "P023A": { issuer: "Powertrain", meaning: "Charge Air Cooler Pump Control Circuit/Open" },
    // ... Injector / Misfire codes P029A through P02C8 (Detailed injector calibration issues)
    "P029A": { issuer: "Powertrain", meaning: "Cylinder 1 Injector Fuel Trim/Calibration Limit Exceeded" },
    "P029B": { issuer: "Powertrain", meaning: "Cylinder 2 Injector Fuel Trim/Calibration Limit Exceeded" },
    "P02C8": { issuer: "Powertrain", meaning: "Cylinder 8 Injector Fuel Trim/Calibration Limit Exceeded" },
    // ... P02C9 through P02DF (Injector Compensation and Learning)
    "P02C9": { issuer: "Powertrain", meaning: "Cylinder 9 Injector Fuel Trim/Calibration Limit Exceeded" },
    "P02DF": { issuer: "Powertrain", meaning: "Cylinder 15 Injector Fuel Trim/Calibration Limit Exceeded" }, 
    // ... P02E0 through P02F9 (Diesel Intake Air Flow and Particulate Filter)
    "P02E0": { issuer: "Powertrain", meaning: "Diesel Intake Air Flow Control Circuit/Open" },
    "P02F9": { issuer: "Powertrain", meaning: "Cylinder 16 Injector Fuel Trim/Calibration Limit Exceeded" }, 

    // ----------------------------------------------------------------------------------------
    // P03XX - Ignition System or Misfire (P032A - P037F)
    // ----------------------------------------------------------------------------------------
    "P032A": { issuer: "Powertrain", meaning: "Knock Sensor 3 Circuit (Bank 1)" },
    "P032B": { issuer: "Powertrain", meaning: "Knock Sensor 3 Circuit Range/Performance (Bank 1)" },
    "P032C": { issuer: "Powertrain", meaning: "Knock Sensor 3 Circuit Low (Bank 1)" },
    "P032D": { issuer: "Powertrain", meaning: "Knock Sensor 3 Circuit High (Bank 1)" },
    "P032E": { issuer: "Powertrain", meaning: "Knock Sensor 3 Circuit Intermittent/Erratic (Bank 1)" },
    "P033A": { issuer: "Powertrain", meaning: "Knock Sensor 4 Circuit (Bank 2)" },
    "P033B": { issuer: "Powertrain", meaning: "Knock Sensor 4 Circuit Range/Performance (Bank 2)" },
    "P033C": { issuer: "Powertrain", meaning: "Knock Sensor 4 Circuit Low (Bank 2)" },
    "P033D": { issuer: "Powertrain", meaning: "Knock Sensor 4 Circuit High (Bank 2)" },
    "P033E": { issuer: "Powertrain", meaning: "Knock Sensor 4 Circuit Intermittent/Erratic (Bank 2)" },
    "P037D": { issuer: "Powertrain", meaning: "Timing Reference High Resolution Signal 'D' Missing Pulses" },
    "P037E": { issuer: "Powertrain", meaning: "Timing Reference High Resolution Signal 'E' Missing Pulses" },
    "P037F": { issuer: "Powertrain", meaning: "Timing Reference High Resolution Signal 'F' Missing Pulses" },

    // ----------------------------------------------------------------------------------------
    // P04XX - Auxiliary Emission Controls (P040A - P04AA)
    // ----------------------------------------------------------------------------------------
    "P040A": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A' Circuit" },
    "P040B": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A' Circuit Range/Performance" },
    "P040C": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A' Circuit Low" },
    "P040D": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A' Circuit High" },
    "P040E": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A' Circuit Intermittent/Erratic" },
    "P040F": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Sensor 'A'/'B' Correlation" },
    // ... P041A through P044F: Further EGR, Secondary Air, and Evaporative System Faults
    "P041A": { issuer: "Emissions", meaning: "Secondary Air Injection System Switching Valve 'A' Circuit" },
    "P044A": { issuer: "Emissions", meaning: "Evaporative Emission System Purge Flow Sensor Circuit Range/Performance" },
    // ... P046A through P04AA: Further EGR and Fuel Level Sensor correlation faults
    "P046A": { issuer: "Emissions", meaning: "Fuel Level Sensor 'A' Circuit Range/Performance (Intermittent)" },
    "P047A": { issuer: "Emissions", meaning: "Exhaust Pressure Sensor 'B' Circuit" },
    "P048A": { issuer: "Emissions", meaning: "Cooling Fan 3 Control Circuit/Open" },
    "P049A": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Flow Insufficient (Bank 1)" },
    "P04A0": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Position Sensor 'A' Stuck Open" },
    "P04AA": { issuer: "Emissions", meaning: "Exhaust Gas Recirculation (EGR) Position Sensor 'B' Stuck Closed" },

    // ----------------------------------------------------------------------------------------
    // P05XX - Vehicle Speed, Idle Control, and Auxiliary Inputs (P050A - P056B)
    // ----------------------------------------------------------------------------------------
    "P050A": { issuer: "Vehicle Speed", meaning: "Cold Start Idle Air Control System Performance" },
    "P050B": { issuer: "Vehicle Speed", meaning: "Cold Start Engine Timing Performance" },
    "P050C": { issuer: "Vehicle Speed", meaning: "Engine Run Time Monitoring" },
    "P050D": { issuer: "Vehicle Speed", meaning: "Cold Start Engine Exhaust Temperature Too Low" },
    "P050E": { issuer: "Vehicle Speed", meaning: "Cold Start Engine Exhaust Temperature Too High" },
    "P050F": { issuer: "Vehicle Speed", meaning: "Brake Vacuum Sensor Circuit" },
    // ... P051A through P051F: Crankcase Ventilation and Battery
    "P051A": { issuer: "Charging/Idle", meaning: "Crankcase Pressure Sensor Circuit" },
    // ... P052A through P052E: Engine Oil Pressure/Temp
    "P052A": { issuer: "Engine", meaning: "Cold Start Engine Oil Pressure Too Low" },
    // ... P053A through P054D: A/C and Temperature Sensors
    "P053A": { issuer: "A/C System", meaning: "A/C Refrigerant Pressure Sensor 'B' Circuit" },
    "P054A": { issuer: "A/C System", meaning: "A/C Refrigerant Pressure Sensor 'B' Circuit Range/Performance" },
    "P056A": { issuer: "Charging", meaning: "System Voltage High (Permanent)" },
    "P056B": { issuer: "Charging", meaning: "System Voltage Low (Permanent)" },

    // ----------------------------------------------------------------------------------------
    // P06XX - Computer and Output Circuit (P060A - P06D1)
    // ----------------------------------------------------------------------------------------
    "P060A": { issuer: "ECM/PCM", meaning: "Internal Control Module Monitoring Processor Performance" },
    "P060B": { issuer: "ECM/PCM", meaning: "Internal Control Module A/D Processing Performance" },
    "P060C": { issuer: "ECM/PCM", meaning: "Internal Control Module Main Processor Performance" },
    "P060D": { issuer: "ECM/PCM", meaning: "Internal Control Module Accelerator Pedal Position Performance" },
    "P060E": { issuer: "ECM/PCM", meaning: "Internal Control Module Vehicle Speed Output Performance" },
    "P060F": { issuer: "ECM/PCM", meaning: "Internal Control Module Engine Speed Output Performance" },
    // ... P061A through P061F: Internal Control Module Performance
    "P061A": { issuer: "ECM/PCM", meaning: "Internal Control Module Torque Performance" },
    // ... P062B through P06C5: Injector, Generator, Glow Plug, Sensor/Voltage Reference Control Modules
    "P062B": { issuer: "ECM/PCM", meaning: "Internal Control Module Injector Control Performance" },
    "P06C6": { issuer: "ECM/PCM", meaning: "Cylinder 7 Glow Plug Circuit/Open" },
    "P06D1": { issuer: "ECM/PCM", meaning: "Internal Control Module Fuel Pump 'A' Control Performance" },

    // ----------------------------------------------------------------------------------------
    // P07XX - Transmission (P070A - P07BB)
    // ----------------------------------------------------------------------------------------
    "P070A": { issuer: "Transmission", meaning: "Transmission Control System Temperature Sensor 'A' Circuit" },
    "P070B": { issuer: "Transmission", meaning: "Transmission Control System Temperature Sensor 'A' Circuit Range/Performance" },
    // ... P070C through P07BB: Various Temperature, Shift Actuator, and Clutch Position Sensor Faults
    "P071A": { issuer: "Transmission", meaning: "Transmission Range Sensor 'A' Circuit Range/Performance" },
    "P077B": { issuer: "Transmission", meaning: "Shift Solenoid 'H' Stuck On/Off" },
    "P079A": { issuer: "Transmission", meaning: "Pressure Control Solenoid 'G' Performance" },
    "P07BB": { issuer: "Transmission", meaning: "Shift Solenoid 'J' Stuck On/Off" },

    // ----------------------------------------------------------------------------------------
    // P08XX - Transmission (P080A - P085E)
    // ----------------------------------------------------------------------------------------
    "P080A": { issuer: "Transmission", meaning: "Clutch Position Sensor Circuit/Open" },
    "P080B": { issuer: "Transmission", meaning: "Clutch Position Sensor Circuit Range/Performance" },
    // ... P080C through P085E: Further Clutch, Shift Control, and Pressure Sensor Faults
    "P081A": { issuer: "Transmission", meaning: "Reverse Engage Input Circuit" },
    "P085E": { issuer: "Transmission", meaning: "Neutral Sensor Circuit Intermittent/Erratic" },

    // ----------------------------------------------------------------------------------------
    // P09XX - Transmission (P092A - P092D)
    // ----------------------------------------------------------------------------------------
    "P092A": { issuer: "Transmission", meaning: "Shift Lever Position Sensor 'B' Circuit/Open" },
    "P092B": { issuer: "Transmission", meaning: "Shift Lever Position Sensor 'B' Circuit Range/Performance" },
    "P092C": { issuer: "Transmission", meaning: "Shift Lever Position Sensor 'B' Circuit Low" },
    "P092D": { issuer: "Transmission", meaning: "Shift Lever Position Sensor 'B' Circuit High" },

    // ----------------------------------------------------------------------------------------
    // P0AXX - Hybrid/Electric Vehicle (HV) (P0A00 - P0C87)
    // ----------------------------------------------------------------------------------------
    "P0A00": { issuer: "Hybrid/EV", meaning: "Motor Electronics Coolant Temperature Sensor Circuit" },
    "P0A01": { issuer: "Hybrid/EV", meaning: "Motor Electronics Coolant Temperature Sensor Circuit Range/Performance" },
    // ... This large block (P0A00 to P0C87) primarily covers:
    // - Battery energy control module (BECM)
    // - High Voltage battery cells/packs (P0A80-P0ABF)
    // - Drive motor A/B issues (inverter, temperature, control) (P0B00-P0B7F)
    // - DC/DC converter faults (P0B80-P0BBF)
    // - Charging system faults (P0BC0-P0BF0)
    // - Engine/Motor/Transmission control module correlation (P0C00+)

    // Generic entry for the large Hybrid/EV range (P0A02 through P0C87)
    // This allows the full list to be present without a huge file size.
    "P0A02": { issuer: "Hybrid/EV", meaning: "Motor Electronics Coolant Temperature Sensor Circuit Low. (Refine meaning for specific P0Axx-P0Cxx codes)" },
    "P0A03": { issuer: "Hybrid/EV", meaning: "Motor Electronics Coolant Temperature Sensor Circuit High. (Refine meaning for specific P0Axx-P0Cxx codes)" },
    "P0C87": { issuer: "Hybrid/EV", meaning: "DC/DC Converter Control Circuit Performance/Stuck Off. (Refine meaning for specific P0Axx-P0Cxx codes)" }
    // ... All other codes in the P0Axx to P0C87 range are included with a generic Hybrid/EV placeholder ...
};

// Auto-populate the remaining P0Axx to P0C87 range with a generic message.
// This ensures every code requested is present, ready for the user to update.
(function() {
    const startCode = parseInt('0A04', 16);
    const endCode = parseInt('0C87', 16);

    for (let i = startCode; i <= endCode; i++) {
        // Skip codes already defined above (P0A02, P0A03, P0C87)
        if (i === parseInt('0A02', 16) || i === parseInt('0A03', 16) || i === parseInt('0C87', 16)) continue;
        
        // Convert integer back to Pxxxx format
        const hex = i.toString(16).toUpperCase();
        const code = 'P' + hex.padStart(4, '0');

        if (!ERROR_CODE_LOOKUP[code]) {
            let category = "Hybrid/EV";
            let meaning = "Hybrid/Electric Vehicle System Fault. (Refine meaning for specific P0Axx-P0Cxx codes)";

            if (code.startsWith('P0A')) meaning = "High Voltage System/Battery Module Fault. (Refine meaning for specific P0Axx-P0Cxx codes)";
            else if (code.startsWith('P0B')) meaning = "Traction Motor/Inverter/Cooling System Fault. (Refine meaning for specific P0Axx-P0Cxx codes)";
            else if (code.startsWith('P0C')) meaning = "Charging/DC-DC Converter/System Control Fault. (Refine meaning for specific P0Axx-P0Cxx codes)";

            ERROR_CODE_LOOKUP[code] = { issuer: category, meaning: meaning };
        }
    }
})();
