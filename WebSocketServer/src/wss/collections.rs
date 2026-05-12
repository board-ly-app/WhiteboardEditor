// === collections.rs ==============================================================================
//
// Miscellaneous custom data structures.
//
// =================================================================================================

use std::collections::{
    HashMap,
    BTreeSet,
};

// === struct OneToMany ============================================================================
//
// Stores a two-way one-to-many mapping of a single instance of a key type to multiple instances of
// a value type.
//
// Note that only each instance of type Value can only correspond to one instance of type Key.
//
// Keys and values are immutable once inserted. Only deletions and overrides can change key-value
// relations once created.
//
// =================================================================================================
#[derive(Clone,Debug)]
pub struct OneToMany <K, V> {
    values_by_key: HashMap<K, BTreeSet<V>>,
    keys_by_value: HashMap<V, K>,
}// -- end pub struct OneToMany

impl <K: Clone + std::hash::Hash + Ord, V: Clone + std::hash::Hash + Ord> OneToMany <K, V> {
    pub fn new() -> Self {
        Self {
            values_by_key: HashMap::new(),
            keys_by_value: HashMap::new(),
        }
    }// -- end pub fn new

    pub fn insert(&mut self, key: K, value: V) {
        if let Some(values_set) = self.values_by_key.get_mut(&key) {
            values_set.insert(value.clone());
        } else {
            self.values_by_key.insert(key.clone(), BTreeSet::from([
                value.clone(),
            ]));
        }

        self.keys_by_value.insert(value.clone(), key.clone());
    }// -- end pub fn insert

    pub fn get_values_by_key(&self, key: &K) -> Option<&BTreeSet<V>> {
        self.values_by_key.get(key)
    }// -- end pub fn get_values_by_key

    pub fn get_key_by_value(&self, value: &V) -> Option<&K> {
        self.keys_by_value.get(value)
    }// -- end pub fn get_key_by_value

    pub fn remove_key(&mut self, key: &K) {
        if let Some(values_set) = self.values_by_key.get(key) {
            for value in values_set.iter() {
                self.keys_by_value.remove(value);
            }// -- end for value in values_set.iter()
        }

        self.values_by_key.remove(key);
    }// -- end pub fn remove_key

    pub fn remove_value(&mut self, value: &V) {
        if let Some(key) = self.keys_by_value.get(value) {
            let remove_vbk = if let Some(values_set) = self.values_by_key.get_mut(key) {
                values_set.remove(value);

                values_set.is_empty()
            } else {
                panic!("Could not find values set for key")
            };

            if remove_vbk {
                self.values_by_key.remove(key);
            }
        }

        self.keys_by_value.remove(value);
    }// -- end pub fn remove_value
}// -- end impl <K, V> OneToMany <K, V>

// === struct OneToOne =============================================================================
//
// Stores a two-way one-to-one mapping of a single instance of a key type to a  single instance of
// a value type.
//
// Keys and values are immutable once inserted. Only deletions and overrides can change key-value
// relations once created.
//
// =================================================================================================
#[derive(Clone,Debug)]
pub struct OneToOne <K, V> {
    values_by_key: HashMap<K, V>,
    keys_by_value: HashMap<V, K>,
}// -- end pub struct OneToOne

impl <K: Clone + std::hash::Hash + Ord, V: Clone + std::hash::Hash + Ord> OneToOne <K, V> {
    pub fn new() -> Self {
        Self {
            values_by_key: HashMap::new(),
            keys_by_value: HashMap::new(),
        }
    }// -- end pub fn new

    pub fn insert(&mut self, key: K, value: V) {
        self.values_by_key.insert(key.clone(), value.clone());
        self.keys_by_value.insert(value.clone(), key.clone());
    }// -- end pub fn insert

    pub fn get_value_by_key(&self, key: &K) -> Option<&V> {
        self.values_by_key.get(key)
    }// -- end pub fn get_values_by_key

    pub fn get_key_by_value(&self, value: &V) -> Option<&K> {
        self.keys_by_value.get(value)
    }// -- end pub fn get_key_by_value

    pub fn remove_key(&mut self, key: &K) {
        if let Some(value) = self.values_by_key.get(key) {
            self.keys_by_value.remove(value);
        }
        self.values_by_key.remove(key);
    }// -- end pub fn remove_key

    pub fn remove_value(&mut self, value: &V) {
        if let Some(key) = self.keys_by_value.get(value) {
            self.values_by_key.remove(key);
        }
        self.keys_by_value.remove(value);
    }// -- end pub fn remove_value
}// -- end impl <K, V> OneToOne <K, V>
