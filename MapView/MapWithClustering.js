import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MapView from 'react-native-maps';
import { width as w, height as h } from 'react-native-dimension';
import SuperCluster from 'supercluster';
import CustomMarker from './CustomMarker';

export default class MapWithClustering extends Component {

  allowUpdates = true;

  state = {
    currentRegion: this.props.initialRegion,
    clusterStyle: {
      borderRadius: w(15),
      backgroundColor: this.props.clusterColor,
      borderColor: this.props.clusterBorderColor,
      borderWidth: this.props.clusterBorderWidth,
      width: w(15),
      height: w(15),
      justifyContent: 'center',
      alignItems: 'center',
    },
    clusterTextStyle: {
      fontSize: this.props.clusterTextSize,
      color: this.props.clusterTextColor,
      fontWeight: 'bold',
    },
  };

  componentDidMount() {

    this.createMarkersOnMap();

  }

  componentWillReceiveProps(nextProps) {

    this.createMarkersOnMap(nextProps);

  }

  onRegionChangeComplete = (region) => {
    const { latitude, latitudeDelta, longitude, longitudeDelta } = this.state.currentRegion;
    if (region.longitudeDelta <= 80) {
      if ((Math.abs(region.latitudeDelta - latitudeDelta) > latitudeDelta / 8)
        || (Math.abs(region.longitude - longitude) >= longitudeDelta / 5)
        || (Math.abs(region.latitude - latitude) >= latitudeDelta / 5)) {
        this.calculateClustersForMap(region);
      }
    }
  };

  animateToRegion = (region) => {
    //console.log('region animation request');
    this.root.animateToRegion(region);
  }

  animateToRegion = (region, val) => {
    this.root.animateToRegion(region, val);
  }

  animateToCoordinate = (region) => {
    this.root.animateToCoordinate(region);
  }

  animateToCoordinate = (region, val) => {
    this.root.animateToCoordinate(region, val);
  }

  createMarkersOnMap = (props = this.props) => {
    const markers = [];
    const otherChildren = [];

    React.Children.forEach(props.children, (marker) => {
      if (marker && marker.props && marker.props.coordinate) {
        markers.push({
          marker,
          properties: { point_count: 0 },
          geometry: {
            type: 'Point',
            coordinates: [
              marker.props.coordinate.longitude,
              marker.props.coordinate.latitude,
            ],
          },
        });
      } else {
        otherChildren.push(marker);
      }
    });

    if (!this.superCluster) {
      this.superCluster = SuperCluster({
        radius: this.props.radius,
        maxZoom: 7, //Min zoom to show all makers
        minZoom: 0,
      });
    }
    this.superCluster.load(markers);

    this.setState({
      markers,
      otherChildren,
    }, () => {
      this.calculateClustersForMap();
    });
  };

  calculateBBox = region => [
    region.longitude - region.longitudeDelta, // westLng - min lng
    region.latitude - region.latitudeDelta, // southLat - min lat
    region.longitude + region.longitudeDelta, // eastLng - max lng
    region.latitude + region.latitudeDelta// northLat - max lat
  ];

  getBoundsZoomLevel = (bounds, mapDim) => {
    const WORLD_DIM = { height: mapDim.height, width: mapDim.width };
    const ZOOM_MAX = 20;

    function latRad(lat) {
      const sin = Math.sin(lat * Math.PI / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    }

    function zoom(mapPx, worldPx, fraction) {
      return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    const latFraction = (latRad(bounds[3]) - latRad(bounds[1])) / Math.PI;
    const lngDiff = bounds[2] - bounds[0];
    const lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;
    const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
    const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

    return Math.min(latZoom, lngZoom, ZOOM_MAX);
  };

  calculateClustersForMap = async (currentRegion = this.state.currentRegion) => {
    let clusteredMarkers = [];

    // console.log('allow updates: ' + this.allowUpdates);
    // if (!this.allowUpdates)
    //   return;

    //this.allowUpdates = false;
    if (this.props.clustering && this.superCluster) {
      const bBox = this.calculateBBox(currentRegion);
      let zoom = this.getBoundsZoomLevel(bBox, { height: h(100), width: w(100) });
      const clusters = await this.superCluster.getClusters([bBox[0], bBox[1], bBox[2], bBox[3]], zoom);

      console.log("zoom: ", zoom)

      if (zoom > 11) {

        let currentMarkers = this.state.markers;

        clusters.map((item) => {
          //validate is a cluster
          if (item.properties.cluster) {

            //get childs from cluster
            let itemsCluster = this.superCluster.getLeaves(item.properties.cluster_id, Infinity)

            //calculate distance factor from zoom
            var distanceFactor = 1;
            switch (zoom) {
              case 12:
                distanceFactor = 135;
                break;
              case 13:
                distanceFactor = 70;
                break;
              case 14:
                distanceFactor = 40;
                break;
              case 15:
                distanceFactor = 20;
                break;
              case 16:
                distanceFactor = 10;
                break;
            }

            var distance = distanceFactor;
            //intial values
            var angle = 45;
            var factor = 45;
            var radius = 6371e3; //radius of the earth

            itemsCluster.map(itemMarker => {

              var index = 0;

              //loop the marker 
              currentMarkers.map(marker => {

                if (itemMarker.marker.key === marker.marker.key) {

                  let lat1 = item.geometry.coordinates[1]
                  let long1 = item.geometry.coordinates[0]

                  var delta = distance / radius,
                    theta = lat1 * (Math.PI / 180.0),
                    phi = long1 * (Math.PI / 180.0),
                    gamma = angle * (Math.PI / 180.0);

                  // calculate sines and cosines
                  var c_theta = Math.cos(theta), s_theta = Math.sin(theta);
                  var c_phi = Math.cos(phi), s_phi = Math.sin(phi);
                  var c_delta = Math.cos(delta), s_delta = Math.sin(delta);
                  var c_gamma = Math.cos(gamma), s_gamma = Math.sin(gamma);

                  // calculate end vector
                  var x = c_delta * c_theta * c_phi - s_delta * (s_theta * c_phi * c_gamma + s_phi * s_gamma);
                  var y = c_delta * c_theta * s_phi - s_delta * (s_theta * s_phi * c_gamma - c_phi * s_gamma);
                  var z = s_delta * c_theta * c_gamma + c_delta * s_theta;

                  // calculate end lat long
                  var theta2 = Math.asin(z), phi2 = Math.atan2(y, x);

                  var latT1 = theta2 * (180.0 / Math.PI);
                  var lonT1 = phi2 * (180.0 / Math.PI);

                  let coordinates = [{
                    longitude: long1,
                    latitude: lat1
                  },
                  {
                    longitude: lonT1,
                    latitude: latT1
                  }]

                  var clonedElementWithMoreProps = React.cloneElement(
                    itemMarker.marker,
                    { overlap: { "isOverlap": true, coordinates: coordinates } }
                  );

                  //overwrite marker info
                  itemMarker.marker = clonedElementWithMoreProps

                }
                index++;

              })

              angle += factor;
              //
              if (angle > 360) {
                angle -= (360 + 30);
                distance += distanceFactor;
                factor = factor - 15;
              }

            })
          }
        })

        clusters = currentMarkers;
      }

      clusteredMarkers = clusters.map(cluster => (<CustomMarker
        pointCount={cluster.properties.point_count}
        clusterId={cluster.properties.cluster_id}
        geometry={cluster.geometry}
        clusterStyle={this.state.clusterStyle}
        clusterTextStyle={this.state.clusterTextStyle}
        marker={cluster.properties.point_count === 0 ? cluster.marker : null}
        key={JSON.stringify(cluster.geometry) + cluster.properties.cluster_id + cluster.properties.point_count}
        onClusterPress={this.props.onClusterPress}
      />));
    } else {
      clusteredMarkers = this.state.markers.map(marker => marker.marker);
    }

    //console.log(currentRegion.latitude, currentRegion.longitude);

    console.log('updating markers, have length: ' + clusteredMarkers.length);

    this.setState({
      clusteredMarkers, currentRegion
    });

    // this.setState({
    //   clusteredMarkers,
    //   currentRegion,
    // });

    // setTimeout(() => {
    //   this.allowUpdates = true;
    // }, 1000);
  };

  removeChildrenFromProps = (props) => {
    const newProps = {};
    Object.keys(props).forEach((key) => {
      if (key !== 'children') {
        newProps[key] = props[key];
      }
    });
    return newProps;
  };

  render() {
    return (
      <MapView
        {...this.removeChildrenFromProps(this.props)}
        ref={(ref) => { this.root = ref; }}
        initialRegion={this.props.initialRegion}
        onRegionChangeComplete={this.onRegionChangeComplete}
      >
        {this.state.clusteredMarkers}
        {this.state.otherChildren}
      </MapView>
    );
  }
}

MapWithClustering.propTypes = {
  region: PropTypes.object,
  clustering: PropTypes.bool,
  radius: PropTypes.number,
  clusterColor: PropTypes.string,
  clusterTextColor: PropTypes.string,
  clusterBorderColor: PropTypes.string,
  clusterBorderWidth: PropTypes.number,
  clusterTextSize: PropTypes.number,
  onClusterPress: PropTypes.func,
};

const totalSize = num => (Math.sqrt((h(100) * h(100)) + (w(100) * w(100))) * num) / 100;

MapWithClustering.defaultProps = {
  clustering: true,
  radius: w(5),
  clusterColor: '#F5F5F5',
  clusterTextColor: '#FF5252',
  clusterBorderColor: '#FF5252',
  clusterBorderWidth: 1,
  clusterTextSize: totalSize(2.4),
  onClusterPress: () => { },
};
