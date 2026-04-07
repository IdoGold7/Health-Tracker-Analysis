import { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function Index() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session from AsyncStorage on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Keep session state in sync with auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSession(data.session);
    }
  }

  return (
    <ScrollView>
      <View style={{ padding: 20, gap: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ borderWidth: 1, padding: 8 }}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ borderWidth: 1, padding: 8 }}
        />
        <Button title="Sign In" onPress={signIn} />
        {error && <Text style={{ color: 'red' }}>{error}</Text>}
        {session && <Button title="Go to Library" onPress={() => router.push('/library')} />}
        {session && <Button title="Sign Out" onPress={() => supabase.auth.signOut()} />}
      </View>
    </ScrollView>
  );
}
