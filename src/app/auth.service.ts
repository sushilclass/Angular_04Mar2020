import { Inject, Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Client } from '@microsoft/microsoft-graph-client';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import * as process from 'process';
import * as jwt_decode from 'jwt-decode';

import { AlertsService } from './alerts.service';
import { OAuthSettings } from '../oauth';
import { User } from './user';
import { single } from 'rxjs/operators';
import { ThrowStmt } from '@angular/compiler';

import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';

let WSHOST = process.env.WSHOST || "ws://localhost:4000/";


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public authenticated: boolean;
  public user: User;
  _webSocket: WebSocketSubject<any>;
  public token: any;
  public static updateToken: any;
  private oAuthSettings = OAuthSettings;
  public STORAGE_KEY = 'local_token';

  constructor(
    private msalService: MsalService,
    private alertsService: AlertsService,
    @Inject (LOCAL_STORAGE) private storage: StorageService) {

    this.authenticated = this.msalService.getUser() != null;

    if (this.authenticated) {
      this.getUser().then((user) => { this.user = user });
      this.getAccessToken().then((token) => { this.token=token });
    }

  }

  // Prompt the user to sign in and
  // grant consent to the requested permission scopes
  async signIn(): Promise<void> {
    let result = await this.msalService.loginPopup(this.oAuthSettings.scopes)    
      .catch((reason) => {
        this.alertsService.add('Login failed', JSON.stringify(reason, null, 2));
      });
      
    if (result) {
      this.token = result;
      this.storage.remove(this.STORAGE_KEY);
      this.storage.set(this.STORAGE_KEY, this.token);
      this.authenticated = true;
      this.user = await this.getUser();
      return result;
    }   
  }

  // Sign out
  signOut(): void {
    this.msalService.logout();
    this.user = null;
    this.authenticated = false;
    this.storage.remove(this.STORAGE_KEY);
  }

  // Silently request an access token
  async getAccessToken(): Promise<any> {
    // let result = await this.msalService.acquireTokenSilent(this.oAuthSettings.scopes)
    //   .catch((reason) => {
    //     this.alertsService.add('Get token failed', JSON.stringify(reason, null, 2));
    //   });  
    let result = this.storage.get(this.STORAGE_KEY);
    return result;
  }

  private async getUser(): Promise<User> {

    let graphClient = Client.init({
      // Initialize the Graph client with an auth
      // provider that requests the token from the
      // auth service
      authProvider: async (done) => {
        let token = await this.getAccessToken()
          .catch((reason) => {
            done(reason, null);
          });

        if (token) {
          done(null, token);
        } else {
          done("Could not get an access token", null);
        }
      }
    });

   // // Get the user from Graph (GET /me)
   // let graphUser = await graphClient.api('/me').get();
   let userToken = this.storage.get(this.STORAGE_KEY);
   let decoed = jwt_decode(userToken);

    let user = new User();
   // user.displayName = graphUser.displayName;
   // // Prefer the mail property, but fall back to userPrincipalName
   // user.email = graphUser.mail || graphUser.userPrincipalName;

   user.displayName = decoed.name;
   user.email = decoed.preferred_username;

    return user;
  }
}
