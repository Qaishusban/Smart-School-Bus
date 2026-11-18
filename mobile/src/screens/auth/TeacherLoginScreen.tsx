import React from 'react';
import ProfessionalLoginScreen from './ProfessionalLoginScreen';

export default function TeacherLoginScreen({ navigation }: any) {
  return <ProfessionalLoginScreen navigation={navigation} role="teacher" />;
}
