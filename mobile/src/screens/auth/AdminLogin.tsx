import React from 'react';
import ProfessionalLoginScreen from './ProfessionalLoginScreen';

export default function AdminLogin({ navigation }: any) {
  return <ProfessionalLoginScreen navigation={navigation} role="admin" />;
}
