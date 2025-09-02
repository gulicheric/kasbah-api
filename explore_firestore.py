#!/usr/bin/env python3
"""
Explore Firestore collections to understand the data structure for orders, users, and products.
"""

import os
import sys
import json
from datetime import datetime

# Add parent directory to path to import tools
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Direct Firebase setup
import firebase_admin
from firebase_admin import credentials, firestore

def init_firestore():
    try:
        firebase_admin.get_app()
    except ValueError:
        cred_path = '/Users/eric/kasbah/kasbah/python/cred.json'
        if not os.path.exists(cred_path):
            print(f"❌ Credentials file not found at {cred_path}")
            return None
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def explore_collection_structure(collection_name, limit=5):
    """Explore the structure of a Firestore collection"""
    print(f"\n🔍 Exploring '{collection_name}' collection...")
    print("=" * 60)
    
    try:
        db = init_firestore()
        if not db:
            print("❌ Failed to initialize Firestore")
            return []
        
        # Get a few documents to understand structure
        docs = db.collection(collection_name).limit(limit).get()
        
        print(f"Found {len(docs)} documents in '{collection_name}'")
        
        sample_docs = []
        for i, doc in enumerate(docs, 1):
            data = doc.to_dict()
            print(f"\n📄 Document {i} (ID: {doc.id}):")
            
            # Show structure but limit data for readability
            if data:
                # Show all keys and types, but truncate long values
                for key, value in data.items():
                    value_type = type(value).__name__
                    if isinstance(value, str) and len(value) > 100:
                        display_value = f"{value[:50]}...({len(value)} chars)"
                    elif isinstance(value, list) and len(value) > 3:
                        display_value = f"[{len(value)} items: {value[:2]}...]"
                    elif isinstance(value, dict) and len(value) > 5:
                        keys = list(value.keys())[:3]
                        display_value = f"{{{len(value)} keys: {keys}...}}"
                    else:
                        display_value = value
                    
                    print(f"  {key}: ({value_type}) {display_value}")
                
                sample_docs.append({
                    'id': doc.id,
                    'data': data
                })
            else:
                print("  (No data)")
        
        return sample_docs
    
    except Exception as e:
        print(f"❌ Error exploring collection '{collection_name}': {e}")
        return []

def find_orders_by_criteria():
    """Look for orders with different criteria to understand structure"""
    print(f"\n🔍 Searching for orders...")
    print("=" * 60)
    
    try:
        db = init_firestore()
        if not db:
            return []
        
        # Try different ways to find orders
        collections_to_try = ['orders', 'Orders', 'order', 'purchase_orders', 'transactions']
        
        for collection_name in collections_to_try:
            try:
                docs = db.collection(collection_name).limit(3).get()
                if docs:
                    print(f"✅ Found orders in collection: '{collection_name}'")
                    
                    for doc in docs:
                        data = doc.to_dict()
                        print(f"  Order ID: {doc.id}")
                        
                        # Look for common order fields
                        order_fields = ['status', 'total', 'customerId', 'supplierId', 'buyerId', 
                                      'created', 'createdAt', 'updated', 'updatedAt', 'items']
                        
                        found_fields = []
                        for field in order_fields:
                            if field in data:
                                found_fields.append(f"{field}: {data[field]}")
                        
                        if found_fields:
                            print(f"    Key fields: {', '.join(found_fields[:3])}")
                        
                        break  # Just show first order
                    return collection_name
            except Exception as e:
                continue  # Try next collection
        
        print("❌ No orders collection found with standard names")
        return None
    
    except Exception as e:
        print(f"❌ Error searching for orders: {e}")
        return None

def explore_users_structure():
    """Explore users collection to understand user data"""
    print(f"\n👥 Exploring users structure...")
    print("=" * 60)
    
    try:
        db = init_firestore()
        if not db:
            return []
        
        # Look at a few users
        users = db.collection('users').limit(3).get()
        
        for user in users:
            data = user.to_dict()
            print(f"\n👤 User ID: {user.id}")
            
            # Show key user fields
            user_fields = ['email', 'name', 'role', 'type', 'companyName', 'created', 'createdAt']
            for field in user_fields:
                if field in data:
                    print(f"  {field}: {data[field]}")
    
    except Exception as e:
        print(f"❌ Error exploring users: {e}")

def explore_products_structure():
    """Explore products collection"""
    print(f"\n📦 Exploring products structure...")
    print("=" * 60)
    
    try:
        db = init_firestore()
        if not db:
            return []
        
        # Get recent products
        products = db.collection('products').limit(5).get()
        
        print(f"Found {len(products)} products")
        
        for i, product in enumerate(products, 1):
            data = product.to_dict()
            print(f"\n📦 Product {i} (ID: {product.id}):")
            
            # Show key product fields
            product_fields = ['name', 'sku', 'price', 'category', 'supplierId', 'uom', 'description']
            for field in product_fields:
                if field in data:
                    value = data[field]
                    if isinstance(value, str) and len(value) > 100:
                        value = f"{value[:50]}..."
                    print(f"  {field}: {value}")
    
    except Exception as e:
        print(f"❌ Error exploring products: {e}")

def main():
    """Main exploration function"""
    print("🔍 FIRESTORE EXPLORATION")
    print("=" * 80)
    print("Exploring Firestore collections to understand data structure for API...")
    
    # Explore key collections
    explore_users_structure()
    
    # Find and explore orders
    orders_collection = find_orders_by_criteria()
    if orders_collection:
        explore_collection_structure(orders_collection, limit=3)
    
    # Explore products
    explore_products_structure()
    
    # List all available collections
    print(f"\n📋 Listing all collections...")
    print("=" * 60)
    
    try:
        db = init_firestore()
        if db:
            collections = db.collections()
            collection_names = [col.id for col in collections]
            print(f"Available collections: {collection_names}")
            
            # Save collection info for reference
            with open('firestore_collections.json', 'w') as f:
                json.dump(collection_names, f, indent=2)
            
            print(f"Collection names saved to: firestore_collections.json")
    
    except Exception as e:
        print(f"❌ Error listing collections: {e}")

if __name__ == "__main__":
    main()