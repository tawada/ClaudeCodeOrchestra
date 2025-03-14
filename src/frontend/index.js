/**
 * ���Ȩ������
 * 
 * ����թ�K�)(Y����Ȩ��UIk�#Y�_����W~Y
 * Sn����go��������hWfЛU�fD~Y
 * 
 * �: ��n���Ȩ�ɋzgoReact NativeVueFlutterji�(Wf
 * �Ф�����Y�K����j��֢��hWf��Y�Sh�J�W~Y
 */

// Snա��o�Ф����Ȩ��n��������gY
// ��n��go�n�Fj�������n)(�WfO`UD:
// - React Native: ͤƣ֢��n�FjD�0n�Ф���
// - Vue.js + Vuetify: ����j��֢��
// - Flutter: �������թ��nͤƣ֢��

// �n��hWf�餢�ȵ��nJavaScript�SSkMnY�ShLgM~Y
// �: �Ф�UIn�,� 

/*
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import axios from 'axios';

// ������ �;b
const ProjectsScreen = ({ navigation }) => {
  const [projects, setProjects] = useState([]);
  
  useEffect(() => {
    // API|s�Wg������ ��֗
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/sessions/projects', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setProjects(res.data.data);
      } catch (err) {
        console.error('������֗���:', err);
      }
    };
    
    fetchProjects();
  }, []);
  
  return (
    <View>
      <Text>������ �</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Sessions', { projectId: item._id })}
          >
            <Text>{item.name}</Text>
            <Text>{item.description}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        onPress={() => navigation.navigate('NewProject')}
      >
        <Text>��������\</Text>
      </TouchableOpacity>
    </View>
  );
};

// �÷�� �;b
const SessionsScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const [sessions, setSessions] = useState([]);
  const [project, setProject] = useState(null);
  
  useEffect(() => {
    // ������ns0�֗
    const fetchProjectAndSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/sessions/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setProject(res.data.data);
        setSessions(res.data.data.sessions || []);
      } catch (err) {
        console.error('������֗���:', err);
      }
    };
    
    fetchProjectAndSessions();
  }, [projectId]);
  
  return (
    <View>
      {project && <Text>{project.name} - �÷�� �</Text>}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Chat', { sessionId: item._id })}
          >
            <Text>�÷��ID: {item.sessionId}</Text>
            <Text>�����: {item.status}</Text>
            <Text> B��ƣ�: {new Date(item.lastActive).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        onPress={() => navigation.navigate('NewSession', { projectId })}
      >
        <Text>���÷���</Text>
      </TouchableOpacity>
    </View>
  );
};

// ��n�Ӳ����
const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Projects" component={ProjectsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
*/

// Sn����o�ï���K����gU��ShojO
// ��n���Ȩ�ɳ��o��������LfY�ա��hWfЛU�~Y