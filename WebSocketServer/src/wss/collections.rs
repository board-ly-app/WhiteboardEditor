// === collections.rs ==============================================================================
//
// Miscellaneous custom data structures.
//
// =================================================================================================

use std::collections::{
    hash_map,
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

pub struct OneToManyIter <'a, K, V> {
    keys_by_value_iter: hash_map::Iter<'a, V, K>,
}// -- end pub struct OneToManyIter

impl <'a, K, V> std::iter::Iterator for OneToManyIter<'a, K, V> {
    type Item = (&'a K, &'a V);

    fn next(&mut self) -> Option<Self::Item> {
        let next_vk = self.keys_by_value_iter.next();

        next_vk.map(|(v, k)| (k, v))
    }// -- end fn next
}// -- end impl std::iter::Iterator for OneToManyIter

impl <K: Clone + std::hash::Hash + Ord, V: Clone + std::hash::Hash + Ord> OneToMany <K, V> {
    pub fn new() -> Self {
        Self {
            values_by_key: HashMap::new(),
            keys_by_value: HashMap::new(),
        }
    }// -- end pub fn new

    pub fn len(&self) -> usize {
        self.keys_by_value.len()
    }// -- end pub fn len

    pub fn iter(&self) -> OneToManyIter<'_, K, V> {
        OneToManyIter {
            keys_by_value_iter: self.keys_by_value.iter(),
        }
    }// -- end pub fn iter

    pub fn insert(&mut self, key: K, value: V) {
        // -- remove old value => key mapping, if present
        if let Some(old_key) = self.keys_by_value.get(&value) {
            let to_remove_key = if let Some(values_set) = self.values_by_key.get_mut(old_key) {
                values_set.remove(&value);

                values_set.is_empty()
            } else {
                false
            };// -- end let to_remove_key

            if to_remove_key {
                self.values_by_key.remove(old_key);
            }
        }
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

    pub fn len(&self) -> usize {
        self.values_by_key.len()
    }// -- end pub fn len

    pub fn insert(&mut self, key: K, value: V) {
        // -- remove old mappings
        if let Some(value) = self.values_by_key.get(&key) {
            self.keys_by_value.remove(value);
        }
        if let Some(key) = self.keys_by_value.get(&value) {
            self.values_by_key.remove(key);
        }

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

    pub fn iter_key_value<'a>(&'a self) -> std::collections::hash_map::Iter<'a, K, V> {
        self.values_by_key.iter()
    }// -- end pub fn iter_key_value
}// -- end impl <K, V> OneToOne <K, V>

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn initialize_one_to_one() {
        let mut mapping = OneToOne::<String, i32>::new();

        mapping.insert(String::from("alpha"), 11);
        mapping.insert(String::from("beta"), 22);
        mapping.insert(String::from("gamma"), 33);

        assert!(mapping.len() == 3);
        assert!(*mapping.get_value_by_key(&String::from("alpha")).unwrap() == 11);
        assert!(*mapping.get_value_by_key(&String::from("beta")).unwrap() == 22);
        assert!(*mapping.get_value_by_key(&String::from("gamma")).unwrap() == 33);
        assert!(mapping.get_key_by_value(&11).unwrap().as_str() == "alpha");
        assert!(mapping.get_key_by_value(&22).unwrap().as_str() == "beta");
        assert!(mapping.get_key_by_value(&33).unwrap().as_str() == "gamma");
    }// -- end fn initialize_one_to_one

    #[test]
    fn clear_one_to_one_by_key() {
        let mut mapping = OneToOne::<String, i32>::new();

        // -- initialize key-value pairs
        mapping.insert(String::from("alpha"), 11);
        mapping.insert(String::from("beta"), 22);
        mapping.insert(String::from("gamma"), 33);

        // -- make sure it's full
        assert!(mapping.len() == 3);
        assert!(*mapping.get_value_by_key(&String::from("alpha")).unwrap() == 11);
        assert!(*mapping.get_value_by_key(&String::from("beta")).unwrap() == 22);
        assert!(*mapping.get_value_by_key(&String::from("gamma")).unwrap() == 33);
        assert!(mapping.get_key_by_value(&11).unwrap().as_str() == "alpha");
        assert!(mapping.get_key_by_value(&22).unwrap().as_str() == "beta");
        assert!(mapping.get_key_by_value(&33).unwrap().as_str() == "gamma");

        // -- remove all entries by key
        mapping.remove_key(&String::from("alpha"));
        mapping.remove_key(&String::from("beta"));
        mapping.remove_key(&String::from("gamma"));

        // -- ensure mapping is empty
        assert!(mapping.len() == 0);
        assert!(mapping.get_value_by_key(&String::from("alpha")).is_none());
        assert!(mapping.get_value_by_key(&String::from("beta")).is_none());
        assert!(mapping.get_value_by_key(&String::from("gamma")).is_none());
    }// -- end fn clear_one_to_one

    #[test]
    fn clear_one_to_one_by_value() {
        let mut mapping = OneToOne::<String, i32>::new();

        // -- initialize key-value pairs
        mapping.insert(String::from("alpha"), 11);
        mapping.insert(String::from("beta"), 22);
        mapping.insert(String::from("gamma"), 33);

        // -- make sure it's full
        assert!(mapping.len() == 3);
        assert!(*mapping.get_value_by_key(&String::from("alpha")).unwrap() == 11);
        assert!(*mapping.get_value_by_key(&String::from("beta")).unwrap() == 22);
        assert!(*mapping.get_value_by_key(&String::from("gamma")).unwrap() == 33);
        assert!(mapping.get_key_by_value(&11).unwrap().as_str() == "alpha");
        assert!(mapping.get_key_by_value(&22).unwrap().as_str() == "beta");
        assert!(mapping.get_key_by_value(&33).unwrap().as_str() == "gamma");

        // -- remove all entries by value
        mapping.remove_value(&11);
        mapping.remove_value(&22);
        mapping.remove_value(&33);

        // -- ensure mapping is empty
        assert!(mapping.len() == 0);
        assert!(mapping.get_value_by_key(&String::from("alpha")).is_none());
        assert!(mapping.get_value_by_key(&String::from("beta")).is_none());
        assert!(mapping.get_value_by_key(&String::from("gamma")).is_none());
    }// -- end fn clear_one_to_one
}// -- end mod test
