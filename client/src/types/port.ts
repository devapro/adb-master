export interface PortForward {
  localPort: number;
  remotePort: number;
}

export interface PortForwardList {
  forwards: PortForward[];
  reverses: PortForward[];
}
